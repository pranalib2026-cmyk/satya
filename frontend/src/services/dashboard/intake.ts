import { delay } from './api'
import { dateOnly } from '@/data/dashboard-mock-data'
import type { CaseProfile, Complexity, Urgency } from '@/types/dashboard'

export interface IntakeAnswers {
  facts: string
  when: string
  who: string
  documents: string[]
  urgency: string
}

const urgencyMap: Record<string, Urgency> = {
  Emergency: 'immediate',
  'Within a week': 'immediate',
  'This month': 'time-bound',
  'Not urgent': 'routine',
}

const complexityFor = (facts: string): Complexity => {
  const t = facts.toLowerCase()
  if (/cheque|138|bounce/.test(t)) return 'advocate-advised'
  if (/arrest|violence|threat|assault/.test(t)) return 'specialist-needed'
  if (/refund|deposit|notice|rti|consumer/.test(t)) return 'self-help-possible'
  return 'advocate-advised'
}

/**
 * Mock issue classifier.
 * TODO: replace with the backend classifier / LLM pipeline. The response shape is
 * intentionally identical to the Pydantic `CaseProfile` schema.
 */
export async function classifyIntake(answers: IntakeAnswers): Promise<CaseProfile> {
  await delay(900)
  const t = answers.facts.toLowerCase()
  const isCheque = /cheque|bounce|138/.test(t)
  const isFamily = /divorce|maintenance|husband|wife|domestic/.test(t)
  const complexity = complexityFor(answers.facts)

  return {
    id: 'case_2041',
    title: isCheque
      ? 'Cheque bounce — payment recovery'
      : isFamily
        ? 'Family maintenance matter'
        : 'Security deposit not refunded by landlord',
    category: isCheque ? 'Cheque bounce' : isFamily ? 'Family' : 'Tenancy',
    subCategory: isCheque ? 'Section 138 NI Act notice' : isFamily ? 'Maintenance' : 'Refund of security deposit',
    probableForum: isCheque
      ? 'Magistrate Court, Bengaluru Urban'
      : isFamily
        ? 'Family Court, Bengaluru'
        : 'Rent Controller, Bengaluru Urban',
    urgency: urgencyMap[answers.urgency] ?? 'time-bound',
    complexity,
    keyDates: [
      { label: 'Incident / trigger', date: dateOnly(-30), basis: 'From your answers' },
      { label: 'Suggested notice date', date: dateOnly(4), basis: 'Allow a 15-day reply window' },
    ],
    confidence: complexity === 'self-help-possible' ? 0.86 : 0.79,
    status: 'draft',
    summary: answers.facts,
    userGoal: 'Get a clear next step and recover what is owed.',
    updatedAt: new Date().toISOString(),
  }
}

export function saveCaseProfile(profile: CaseProfile) {
  // TODO: POST /cases -> cases table. Mock persists to localStorage for the demo.
  if (typeof window !== 'undefined') localStorage.setItem('legal_case_profile', JSON.stringify(profile))
  return profile
}

export function loadCaseProfile(): CaseProfile | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('legal_case_profile')
  if (!raw) return null
  try {
    return JSON.parse(raw) as CaseProfile
  } catch {
    return null
  }
}
