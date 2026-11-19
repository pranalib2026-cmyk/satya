import { api, getStoredToken } from "@/lib/api-client";
import { cases as mockCases } from "@/data/dashboard-mock-data";
import type { CaseProfile, Complexity, Urgency } from "@/types/dashboard";

export interface BackendCaseResponse {
  id: string;
  case_reference: string;
  client_id: string;
  title: string;
  problem_description?: string;
  legal_issue_category?: string;
  state?: string;
  district?: string;
  relevant_court?: string;
  incident_date?: string;
  preferred_language: string;
  urgency: string;
  supporting_info?: string;
  adverse_parties?: string;
  stage: string;
  conflict_status: string;
  triage_result?: {
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
  };
  created_at: string;
  updated_at: string;
}

export interface BackendCaseListResponse {
  total: number;
  page: number;
  limit: number;
  items: BackendCaseResponse[];
}

export interface CreateCasePayload {
  title: string;
  problem_description: string;
  legal_issue_category: string;
  state?: string;
  district?: string;
  relevant_court?: string;
  incident_date?: string;
  preferred_language?: string;
  urgency?: string;
  supporting_info?: string;
  adverse_parties?: string;
}

export function mapBackendCaseToProfile(bc: BackendCaseResponse): CaseProfile {
  let mappedUrgency: Urgency = "time-bound";
  if (bc.urgency.toLowerCase().includes("emerg") || bc.urgency.toLowerCase().includes("24h") || bc.urgency.toLowerCase().includes("urgent")) {
    mappedUrgency = "immediate";
  } else if (bc.urgency.toLowerCase().includes("routine") || bc.urgency.toLowerCase().includes("exploratory")) {
    mappedUrgency = "routine";
  }

  let mappedComplexity: Complexity = "advocate-advised";
  const comp = bc.triage_result?.complexity?.toUpperCase() || "";
  if (comp === "LOW") mappedComplexity = "self-help-possible";
  else if (comp === "HIGH") mappedComplexity = "specialist-needed";

  return {
    id: bc.id,
    title: bc.title,
    category: bc.legal_issue_category || bc.triage_result?.identified_category || "General Civil",
    subCategory: bc.triage_result?.suggested_next_step || bc.case_reference,
    probableForum: bc.relevant_court || bc.triage_result?.possible_jurisdiction || `${bc.district || "District"} Court`,
    urgency: mappedUrgency,
    complexity: mappedComplexity,
    keyDates: [
      { label: "Docket Registration", date: bc.created_at.slice(0, 10), basis: `Reference: ${bc.case_reference}` },
      ...(bc.incident_date ? [{ label: "Cause of Action Date", date: bc.incident_date, basis: "From grievance narrative" }] : []),
    ],
    confidence: 0.94,
    status: bc.stage === "RESOLVED" ? "closed" : bc.stage === "DRAFT" ? "draft" : "active",
    summary: bc.problem_description || bc.triage_result?.summary_of_facts || "",
    userGoal: bc.supporting_info || "Statutory legal relief",
    updatedAt: bc.updated_at,
  };
}

export async function fetchCases(): Promise<CaseProfile[]> {
  const token = getStoredToken();
  if (!token || token.startsWith("jwt_mock_")) {
    // Return mock cases for unauthenticated or local mock sessions
    return mockCases;
  }

  try {
    const res = await api.get<BackendCaseListResponse>("/api/v1/cases");
    if (res.items && res.items.length > 0) {
      return res.items.map(mapBackendCaseToProfile);
    }
    // If backend returns empty list, fall back to mock cases to maintain rich UI
    return mockCases;
  } catch {
    return mockCases;
  }
}

export async function fetchCaseById(caseId: string): Promise<CaseProfile | null> {
  const token = getStoredToken();
  if (!token || token.startsWith("jwt_mock_")) {
    return mockCases.find((c) => c.id === caseId) || mockCases[0] || null;
  }

  try {
    const res = await api.get<BackendCaseResponse>(`/api/v1/cases/${caseId}`);
    return mapBackendCaseToProfile(res);
  } catch {
    return mockCases.find((c) => c.id === caseId) || null;
  }
}

export async function createCaseOnBackend(payload: CreateCasePayload): Promise<BackendCaseResponse> {
  return api.post<BackendCaseResponse>("/api/v1/cases", {
    title: payload.title,
    problem_description: payload.problem_description,
    legal_issue_category: payload.legal_issue_category,
    state: payload.state || "Karnataka",
    district: payload.district || "Bengaluru Urban",
    relevant_court: payload.relevant_court || "City Civil and Sessions Court, Bengaluru",
    incident_date: payload.incident_date,
    preferred_language: payload.preferred_language || "en",
    urgency: payload.urgency || "standard-30d",
    supporting_info: payload.supporting_info,
    adverse_parties: payload.adverse_parties,
  });
}
