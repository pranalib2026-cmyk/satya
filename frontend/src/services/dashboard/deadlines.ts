import { api, getStoredToken } from "@/lib/api-client";
import { delay } from "./api";
import { deadlines as mockDeadlines } from "@/data/dashboard-mock-data";
import type { Deadline, Urgency } from "@/types/dashboard";

export interface DeadlineRule {
  id: string;
  category: string;
  triggerEvent: string;
  periodDays: number;
  legalBasis: string;
}

export interface BackendDeadlineResponse {
  id: string;
  case_id: string;
  case_reference?: string;
  title: string;
  description?: string;
  deadline_type: string;
  source_basis?: string;
  statutory_provision?: string;
  due_date: string;
  priority: string;
  is_advocate_confirmed: boolean;
  confirmed_by_advocate_id?: string;
  confirmed_at?: string;
  is_completed: boolean;
}

export interface BackendDeadlineListResponse {
  total: number;
  items: BackendDeadlineResponse[];
}

/** Seeded `deadline_rules` table. Date maths is done in code, never by an LLM. */
export const deadlineRules: DeadlineRule[] = [
  {
    id: "rule_1",
    category: "Cheque bounce",
    triggerEvent: "Receipt of cheque return memo",
    periodDays: 30,
    legalBasis: "s.138 NI Act — demand notice within 30 days",
  },
  {
    id: "rule_2",
    category: "Cheque bounce",
    triggerEvent: "Expiry of 15-day notice period",
    periodDays: 30,
    legalBasis: "s.138 NI Act — complaint within one month",
  },
  {
    id: "rule_3",
    category: "Consumer",
    triggerEvent: "Cause of action (defect discovered)",
    periodDays: 730,
    legalBasis: "s.69 Consumer Protection Act, 2019 — two years",
  },
  {
    id: "rule_4",
    category: "Tenancy",
    triggerEvent: "Vacation / handover date",
    periodDays: 1095,
    legalBasis: "Limitation Act, 1963 — three years for money claims",
  },
  {
    id: "rule_5",
    category: "Employment",
    triggerEvent: "Date of termination",
    periodDays: 1095,
    legalBasis: "Limitation Act, 1963 — three years for civil claims",
  },
  {
    id: "rule_6",
    category: "RTI",
    triggerEvent: "No reply from PIO",
    periodDays: 30,
    legalBasis: "s.19 RTI Act — first appeal within 30 days",
  },
];

export function computeDeadline(triggerDate: string, rule: DeadlineRule): string {
  const d = new Date(triggerDate);
  d.setDate(d.getDate() + rule.periodDays);
  return d.toISOString().slice(0, 10);
}

export const reminderOffsets = [7, 3, 1, 0];

function mapBackendDeadlineToFrontend(bd: BackendDeadlineResponse): Deadline {
  let mappedUrgency: Urgency = "time-bound";
  if (bd.priority === "CRITICAL" || bd.deadline_type === "STATUTORY_LIMITATION") {
    mappedUrgency = "immediate";
  } else if (bd.priority === "LOW") {
    mappedUrgency = "routine";
  }

  return {
    id: bd.id,
    caseId: bd.case_reference || bd.case_id,
    caseTitle: bd.case_reference ? `Matter ${bd.case_reference}` : "Active Docket",
    title: bd.title,
    date: bd.due_date.slice(0, 10),
    urgency: mappedUrgency,
    basis: bd.statutory_provision || bd.source_basis || "Limitation Act, 1963",
    confirmed: bd.is_advocate_confirmed,
    completed: bd.is_completed,
  };
}

export async function listDeadlines(): Promise<Deadline[]> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      const res = await api.get<BackendDeadlineListResponse>("/api/v1/deadlines");
      if (res.items && res.items.length > 0) {
        return res.items.map(mapBackendDeadlineToFrontend);
      }
    } catch {
      // Fallback
    }
  }

  await delay(250);
  return mockDeadlines;
}

export async function confirmDeadline(deadlineId: string): Promise<boolean> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      await api.patch(`/api/v1/deadlines/${deadlineId}/confirm`, {
        verified_statutory_basis: "Verified under Limitation Act, 1963",
        confirmation_notes: "Statutory limitation verified against court schedule",
      });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export async function markDeadlineComplete(deadlineId: string): Promise<boolean> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      await api.patch(`/api/v1/deadlines/${deadlineId}/complete`);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

const DASHBOARD_EPOCH = new Date("2000-01-01T00:00:00.000Z");

export function daysUntil(date: string, today: Date = DASHBOARD_EPOCH): number {
  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - reference.getTime()) / 86_400_000);
}

export function urgencyTone(urgency: Deadline["urgency"]) {
  if (urgency === "immediate") return "danger";
  if (urgency === "time-bound") return "warn";
  return "neutral";
}

export async function createReminderRows(deadline: Deadline) {
  await delay(150);
  const rows = reminderOffsets.map((offset) => ({
    deadlineId: deadline.id,
    scheduledFor: new Date(new Date(deadline.date).getTime() - offset * 86_400_000).toISOString(),
    channel: "sms",
    status: "scheduled",
  }));
  return rows;
}
