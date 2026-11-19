import { api } from "@/lib/api-client";
import { delay } from "./api";
import type { CaseProfile, TriagePath, TriageResult } from "@/types/dashboard";

const EMERGENCY_WORDS = [
  "arrest",
  "police custody",
  "violence",
  "assault",
  "threat",
  "abuse",
  "suicide",
  "stalking",
  "eviction tonight",
  "kidnap",
];

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

/**
 * Deterministic rule-based triage. No LLM, no payment signals.
 */
export function runTriage(input: {
  profile: CaseProfile;
  annualIncome?: number;
  emergencyFlag?: boolean;
}): TriageResult {
  const text = `${input.profile.summary} ${input.profile.title}`.toLowerCase();
  const emergency = input.emergencyFlag || EMERGENCY_WORDS.some((w) => text.includes(w));
  const lowIncome = (input.annualIncome ?? 600000) <= 300000;

  const rules: string[] = [];
  let recommended: TriagePath["key"];

  if (emergency) {
    recommended = "emergency";
    rules.push("Emergency keyword detected in the facts.");
  } else if (lowIncome) {
    recommended = "legal-aid";
    rules.push("Annual household income is at or below the legal aid threshold.");
  } else if (input.profile.complexity === "self-help-possible") {
    recommended = "self-help";
    rules.push("Low complexity matter with a standard template available.");
  } else {
    recommended = "advocate";
    rules.push("Contested matter that benefits from an advocate’s review.");
  }

  if (input.profile.urgency === "immediate" && recommended !== "emergency") {
    rules.push("Marked urgent — keep the advocate path available.");
  }

  const paths: TriagePath[] = [
    {
      key: "self-help",
      title: "Handle it yourself",
      description: "Use a reviewed template, file it in the right forum, and track the response.",
      recommended: recommended === "self-help",
      reason: "Your matter looks routine and a standard template fits the facts.",
      cta: "Open self-help tools",
      icon: "file",
    },
    {
      key: "legal-aid",
      title: "Free legal aid",
      description: "Check eligibility for a DLSA lawyer at no cost. Helpline 15100.",
      recommended: recommended === "legal-aid",
      reason: "Your stated income may qualify you for free representation.",
      cta: "Check eligibility",
      icon: "handshake",
    },
    {
      key: "advocate",
      title: "Speak to an advocate",
      description: "Match with a verified advocate for your court, language and budget.",
      recommended: recommended === "advocate",
      reason: "The dispute is contested or time-critical, so professional review is safer.",
      cta: "Find an advocate",
      icon: "scale",
    },
    {
      key: "emergency",
      title: "Emergency help",
      description: "Immediate helplines and rights information. Works without AI.",
      recommended: recommended === "emergency",
      reason: "The facts include an urgent safety concern.",
      cta: "Open emergency help",
      icon: "siren",
    },
  ];

  return { recommended, confidence: 0.87, rules, paths };
}

export async function getTriage(profile: CaseProfile, annualIncome?: number): Promise<TriageResult> {
  try {
    const res = await api.post<BackendTriageOutput>("/api/v1/triage/assess", {
      title: profile.title,
      problem_description: profile.summary || profile.title,
      legal_issue_category: profile.category || "Civil",
      state: "Karnataka",
      district: "Bengaluru Urban",
      relevant_court: profile.probableForum || null,
      incident_date: null,
      preferred_language: "en",
      urgency: profile.urgency === "immediate" ? "urgent-48h" : "standard-30d",
      supporting_info: profile.userGoal,
    });

    let recommended: TriagePath["key"] = "advocate";
    if (res.suggested_next_step === "SELF_HELP") recommended = "self-help";
    else if (res.suggested_next_step === "FREE_LEGAL_AID") recommended = "legal-aid";
    else if (res.suggested_next_step === "URGENT_ASSISTANCE") recommended = "emergency";

    const paths: TriagePath[] = [
      {
        key: "self-help",
        title: "Handle it yourself",
        description: "Use a reviewed template, file it in the right forum, and track the response.",
        recommended: recommended === "self-help",
        reason: "Matter complexity is low and statutory form filing is available.",
        cta: "Open self-help tools",
        icon: "file",
      },
      {
        key: "legal-aid",
        title: "Free legal aid (NALSA / DLSA)",
        description: "State legal services authority assistance under Section 12 of LSA Act, 1987. Helpline 15100.",
        recommended: recommended === "legal-aid" || res.show_free_legal_aid,
        reason: "Matter meets criteria for institutional legal services.",
        cta: "Check eligibility",
        icon: "handshake",
      },
      {
        key: "advocate",
        title: "Consult Verified Advocate",
        description: "Match with a verified advocate for your court, language and consultation budget.",
        recommended: recommended === "advocate" || res.advocate_assistance_appropriate,
        reason: "Contested rights or formal court proceedings require qualified advocate representation.",
        cta: "Find an advocate",
        icon: "scale",
      },
      {
        key: "emergency",
        title: "Emergency assistance",
        description: "Immediate helplines and rights information. Statutory safeguard without delay.",
        recommended: recommended === "emergency",
        reason: "Facts indicate immediate rights violation or emergency timeframe.",
        cta: "Open emergency help",
        icon: "siren",
      },
    ];

    const rules = [
      `Assessed Jurisdiction: ${res.possible_jurisdiction}`,
      `Complexity Rating: ${res.complexity}`,
      `Urgency Level: ${res.urgency_level}`,
    ];
    if (res.missing_information && res.missing_information.length > 0) {
      rules.push(`Missing Factual Information: ${res.missing_information.join(", ")}`);
    }

    return {
      recommended,
      confidence: 0.92,
      rules,
      paths,
    };
  } catch {
    await delay(300);
    return runTriage({ profile, annualIncome });
  }
}
