import { delay } from './api'
import { deadlines } from '@/data/dashboard-mock-data'
import type { Deadline } from '@/types/dashboard'

export interface DeadlineRule {
  id: string
  category: string
  triggerEvent: string
  periodDays: number
  legalBasis: string
}

/** Seeded `deadline_rules` table. Date maths is done in code, never by an LLM. */
export const deadlineRules: DeadlineRule[] = [
  {
    id: 'rule_1',
    category: 'Cheque bounce',
    triggerEvent: 'Receipt of cheque return memo',
    periodDays: 30,
    legalBasis: 's.138 NI Act — demand notice within 30 days',
  },
  {
    id: 'rule_2',
    category: 'Cheque bounce',
    triggerEvent: 'Expiry of 15-day notice period',
    periodDays: 30,
    legalBasis: 's.138 NI Act — complaint within one month',
  },
  {
    id: 'rule_3',
    category: 'Consumer',
    triggerEvent: 'Cause of action (defect discovered)',
    periodDays: 730,
    legalBasis: 's.69 Consumer Protection Act, 2019 — two years',
  },
  {
    id: 'rule_4',
    category: 'Tenancy',
    triggerEvent: 'Vacation / handover date',
    periodDays: 1095,
    legalBasis: 'Limitation Act, 1963 — three years for money claims',
  },
  {
    id: 'rule_5',
    category: 'Employment',
    triggerEvent: 'Date of termination',
    periodDays: 1095,
    legalBasis: 'Limitation Act, 1963 — three years for civil claims',
  },
  {
    id: 'rule_6',
    category: 'RTI',
    triggerEvent: 'No reply from PIO',
    periodDays: 30,
    legalBasis: 's.19 RTI Act — first appeal within 30 days',
  },
]

export function computeDeadline(triggerDate: string, rule: DeadlineRule): string {
  const d = new Date(triggerDate)
  d.setDate(d.getDate() + rule.periodDays)
  return d.toISOString().slice(0, 10)
}

/** Scheduler offsets from the reminders table: 7, 3, 1 and 0 days before. */
export const reminderOffsets = [7, 3, 1, 0]

export async function listDeadlines(): Promise<Deadline[]> {
  await delay(400)
  return deadlines
}

const DASHBOARD_EPOCH = new Date('2000-01-01T00:00:00.000Z')

export function daysUntil(date: string, today: Date = DASHBOARD_EPOCH): number {
  const reference = new Date(today)
  reference.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - reference.getTime()) / 86_400_000)
}

export function urgencyTone(urgency: Deadline['urgency']) {
  if (urgency === 'immediate') return 'danger'
  if (urgency === 'time-bound') return 'warn'
  return 'neutral'
}

/**
 * Mock APScheduler run. Creates reminder rows (7/3/1/0 days) and logs a mock send.
 * TODO: implement with APScheduler in backend/app/services/scheduler.py.
 */
export async function createReminderRows(deadline: Deadline) {
  await delay(300)
  const rows = reminderOffsets.map((offset) => ({
    deadlineId: deadline.id,
    scheduledFor: new Date(new Date(deadline.date).getTime() - offset * 86_400_000).toISOString(),
    channel: 'mock-sms',
    status: 'scheduled',
  }))
  console.info('[mock-scheduler] reminders created', rows)
  return rows
}

/** Mock "send due reminders" job. */
export async function runSchedulerTick() {
  await delay(200)
  console.info('[mock-scheduler] tick — no real notifications sent')
}
