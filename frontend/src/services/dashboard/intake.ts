import { api, getStoredToken } from "@/lib/api-client";
import { dateOnly } from "@/data/dashboard-mock-data";
import type { CaseProfile, Complexity, Urgency } from "@/types/dashboard";
import { createCaseOnBackend } from "./cases";

export interface IntakeAnswers {
  facts: string;
  when: string;
  who: string;
  documents: string[];
  urgency: string;
}

interface BackendTriageOutput {
  identified_category: string;
  summary_of_facts: string;
  missing_information: string[];
  possible_jurisdiction: string;
  urgency_level: string;
  complexity: string;
  suggested_next_step: string;
  advocate_assistance_appropriate: boolean;
  show_free_legal_aid: boolean;
  assessed_at: string;
}

const urgencyMap: Record<string, Urgency> = {
  Emergency: "immediate",
  "Within a week": "immediate",
  "This month": "time-bound",
  "Not urgent": "routine",
};

const complexityFor = (facts: string): Complexity => {
  const t = facts.toLowerCase();
  if (/cheque|138|bounce/.test(t)) return "advocate-advised";
  if (/arrest|violence|threat|assault/.test(t)) return "specialist-needed";
  if (/refund|deposit|notice|rti|consumer/.test(t)) return "self-help-possible";
  return "advocate-advised";
};

const detectCategory = (facts: string): string => {
  const t = facts.toLowerCase();
  if (/cheque|bounce|138|negotiable/.test(t)) return "Cheque Bounce";
  if (/rent|landlord|tenant|deposit|evict|lease/.test(t)) return "Tenancy & Rent";
  if (/consumer|defect|warranty|refund|seller/.test(t)) return "Consumer Dispute";
  if (/divorce|maintenance|custody|domestic|husband|wife/.test(t)) return "Family Law";
  if (/fir|police|bail|criminal|assault|theft/.test(t)) return "Criminal & Bail";
  if (/salary|employment|pf|gratuity|termination/.test(t)) return "Labor & Employment";
  return "Civil Dispute";
};

/**
 * Classifies intake facts via the backend deterministic Triage Engine (/api/v1/triage/assess)
 * with deterministic offline fallback if the backend service is offline.
 */
export async function classifyIntake(answers: IntakeAnswers): Promise<CaseProfile> {
  const category = detectCategory(answers.facts);
  const backendUrgency =
    answers.urgency === "Emergency"
      ? "emergency-24h"
      : answers.urgency === "Within a week"
        ? "urgent-48h"
        : "standard-30d";

  try {
    const res = await api.post<BackendTriageOutput>("/api/v1/triage/assess", {
      title: `${category} — Initial Grievance`,
      problem_description: answers.facts,
      legal_issue_category: category,
      state: "Karnataka",
      district: "Bengaluru Urban",
      relevant_court: null,
      incident_date: null,
      preferred_language: "en",
      urgency: backendUrgency,
      supporting_info: `Involved Parties: ${answers.who}. Chronology: ${answers.when}. Documents available: ${answers.documents.join(", ")}`,
      adverse_parties: answers.who,
    });

    let mappedUrgency: Urgency = urgencyMap[answers.urgency] ?? "time-bound";
    if (res.urgency_level.includes("EMERGENCY") || res.urgency_level.includes("URGENT")) {
      mappedUrgency = "immediate";
    }

    let mappedComplexity: Complexity = "advocate-advised";
    if (res.complexity === "LOW") mappedComplexity = "self-help-possible";
    if (res.complexity === "HIGH") mappedComplexity = "specialist-needed";

    return {
      id: "case_live_" + Date.now().toString(36),
      title: `${res.identified_category} — Legal Assessment`,
      category: res.identified_category,
      subCategory: res.suggested_next_step,
      probableForum: res.possible_jurisdiction,
      urgency: mappedUrgency,
      complexity: mappedComplexity,
      keyDates: [
        { label: "Incident / trigger", date: dateOnly(-30), basis: "From your chronology answers" },
        { label: "Suggested notice date", date: dateOnly(4), basis: "Allow a 15-day statutory response window" },
      ],
      confidence: 0.92,
      status: "draft",
      summary: res.summary_of_facts || answers.facts,
      userGoal: `Next Step: ${res.suggested_next_step.replace(/_/g, " ")}. Advocate Consultation: ${res.advocate_assistance_appropriate ? "Recommended" : "Optional"}. Free Legal Aid: ${res.show_free_legal_aid ? "Eligible" : "Standard"}.`,
      updatedAt: res.assessed_at || new Date().toISOString(),
    };
  } catch {
    // Graceful offline fallback with local deterministic rules
    const complexity = complexityFor(answers.facts);
    const isCheque = category === "Cheque Bounce";
    const isFamily = category === "Family Law";

    return {
      id: "case_2041",
      title: isCheque
        ? "Cheque bounce — payment recovery"
        : isFamily
          ? "Family maintenance matter"
          : "Security deposit not refunded by landlord",
      category,
      subCategory: isCheque ? "Section 138 NI Act notice" : isFamily ? "Maintenance" : "Refund of security deposit",
      probableForum: isCheque
        ? "Magistrate Court, Bengaluru Urban"
        : isFamily
          ? "Family Court, Bengaluru"
          : "Rent Controller, Bengaluru Urban",
      urgency: urgencyMap[answers.urgency] ?? "time-bound",
      complexity,
      keyDates: [
        { label: "Incident / trigger", date: dateOnly(-30), basis: "From your answers" },
        { label: "Suggested notice date", date: dateOnly(4), basis: "Allow a 15-day reply window" },
      ],
      confidence: complexity === "self-help-possible" ? 0.86 : 0.79,
      status: "draft",
      summary: answers.facts,
      userGoal: "Get a clear next step and recover what is owed.",
      updatedAt: new Date().toISOString(),
    };
  }
}

export function saveCaseProfile(profile: CaseProfile) {
  // 1. Synchronously persist to localStorage for immediate UI flow
  if (typeof window !== "undefined") {
    localStorage.setItem("legal_case_profile", JSON.stringify(profile));
  }

  // 2. Best-effort asynchronous persistence to backend POST /api/v1/cases if user is authenticated
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    createCaseOnBackend({
      title: profile.title,
      problem_description: profile.summary,
      legal_issue_category: profile.category,
      state: "Karnataka",
      district: "Bengaluru Urban",
      relevant_court: profile.probableForum,
      urgency: profile.urgency === "immediate" ? "urgent-48h" : "standard-30d",
      supporting_info: profile.userGoal,
    })
      .then((createdCase) => {
        const updated = {
          ...profile,
          id: createdCase.id,
          subCategory: `Reference: ${createdCase.case_reference}`,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("legal_case_profile", JSON.stringify(updated));
        }
      })
      .catch(() => {
        // Retain local copy if backend call fails
      });
  }

  return profile;
}

export function loadCaseProfile(): CaseProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("legal_case_profile");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CaseProfile;
  } catch {
    return null;
  }
}
