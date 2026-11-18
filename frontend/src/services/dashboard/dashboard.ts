import { delay } from './api'
import { cases, deadlines, threads } from '@/data/dashboard-mock-data'
import type { DashboardSummary } from '@/types/dashboard'

/** GET /dashboard/summary — one call for all home cards. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  await delay(450)
  return {
    activeCases: cases.filter((c) => c.status === 'active').length,
    unreadMessages: threads.reduce((sum, t) => sum + t.unread, 0),
    pendingActions: 2,
    deadlines: [...deadlines].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    recentCase: cases[0],
  }
}
