import { api, getStoredToken } from '@/lib/api-client'
import type { CaseProfile, DashboardSummary, Deadline } from '@/types/dashboard'

interface BackendRecentCase {
  id: string
  case_reference: string
  title: string
  category: string
  court_forum: string
  stage: string
  stage_label: string
  stage_step: number
  progress_percentage: number
  status: string
  updated_at: string
}

interface BackendDeadline {
  id: string
  case_id: string
  title: string
  date: string
  due_date: string
  days_remaining: number
  urgent: boolean
  priority: string
  basis: string
  confirmed: boolean
  is_confirmed: boolean
}

interface BackendDashboardSummaryResponse {
  active_cases: number
  pending_cases: number
  completed_cases: number
  total_cases: number
  unread_messages: number
  pending_actions: number
  activeCases: number
  unreadMessages: number
  pendingActions: number
  recent_case?: BackendRecentCase | null
  recentCase?: BackendRecentCase | null
  next_deadline?: BackendDeadline | null
  upcoming_deadlines?: BackendDeadline[]
  deadlines?: BackendDeadline[]
}

const DEFAULT_EMPTY_SUMMARY: DashboardSummary = {
  activeCases: 0,
  unreadMessages: 0,
  pendingActions: 0,
  deadlines: [],
  recentCase: undefined,
  active_cases: 0,
  pending_cases: 0,
  completed_cases: 0,
  total_cases: 0,
}

/**
 * GET /api/v1/dashboard/summary
 * Authoritative backend service deriving metrics exclusively from PostgreSQL records.
 * Incorporates resilient offline fallbacks and handles unauthenticated state gracefully.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const token = getStoredToken()

  // If unauthenticated or running in unseeded mock mode, return standard zero-state metrics
  if (!token || token.startsWith('jwt_mock_')) {
    return DEFAULT_EMPTY_SUMMARY
  }

  try {
    const res = await api.get<BackendDashboardSummaryResponse>('/api/v1/dashboard/summary')

    const mappedDeadlines: Deadline[] = (res.deadlines || res.upcoming_deadlines || []).map((d) => ({
      id: d.id,
      caseId: d.case_id,
      caseTitle: d.title,
      title: d.title,
      date: d.date || d.due_date,
      urgent: d.urgent,
      urgency: d.urgent ? 'immediate' : 'time-bound',
      basis: d.basis,
      confirmed: d.confirmed ?? d.is_confirmed ?? false,
      completed: false,
    }))

    const rawCase = res.recent_case || res.recentCase
    let mappedRecentCase: CaseProfile | undefined = undefined

    if (rawCase) {
      mappedRecentCase = {
        id: rawCase.id,
        title: rawCase.title,
        category: rawCase.category,
        subCategory: rawCase.stage_label || rawCase.stage,
        probableForum: rawCase.court_forum,
        urgency: 'routine',
        complexity: 'advocate-advised',
        keyDates: [],
        confidence: (rawCase.progress_percentage || 20) / 100,
        status: rawCase.stage === 'DISPOSED' || rawCase.status === 'closed' ? 'closed' : 'active',
        summary: `${rawCase.stage_label} · Progress Stage ${rawCase.stage_step} of 5 (${rawCase.progress_percentage}%)`,
        userGoal: 'Statutory Resolution',
        updatedAt: rawCase.updated_at,
      }
    }

    return {
      activeCases: res.active_cases ?? res.activeCases ?? 0,
      unreadMessages: res.unread_messages ?? res.unreadMessages ?? 0,
      pendingActions: res.pending_actions ?? res.pendingActions ?? 0,
      deadlines: mappedDeadlines,
      recentCase: mappedRecentCase,
      active_cases: res.active_cases,
      pending_cases: res.pending_cases,
      completed_cases: res.completed_cases,
      total_cases: res.total_cases,
    }
  } catch (err) {
    console.warn('[dashboard] Failed to fetch live summary from backend, using safe fallback:', err)
    return DEFAULT_EMPTY_SUMMARY
  }
}
