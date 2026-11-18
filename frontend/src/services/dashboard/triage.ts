import { delay } from './api'
import type { CaseProfile, TriagePath, TriageResult } from '@/types/dashboard'

const EMERGENCY_WORDS = [
  'arrest',
  'police custody',
  'violence',
  'assault',
  'threat',
  'abuse',
  'suicide',
  'stalking',
  'eviction tonight',
  'kidnap',
]

/**
 * Deterministic rule-based triage. No LLM, no payment signals.
 * TODO: mirror this function in backend/app/services/triage.py and expose /triage.
 */
export function runTriage(input: {
  profile: CaseProfile
  annualIncome?: number
  emergencyFlag?: boolean
}): TriageResult {
  const text = `${input.profile.summary} ${input.profile.title}`.toLowerCase()
  const emergency = input.emergencyFlag || EMERGENCY_WORDS.some((w) => text.includes(w))
  const lowIncome = (input.annualIncome ?? 600000) <= 300000

  const rules: string[] = []
  let recommended: TriagePath['key']

  if (emergency) {
    recommended = 'emergency'
    rules.push('Emergency keyword detected in the facts.')
  } else if (lowIncome) {
    recommended = 'legal-aid'
    rules.push('Annual household income is at or below the legal aid threshold.')
  } else if (input.profile.complexity === 'self-help-possible') {
    recommended = 'self-help'
    rules.push('Low complexity matter with a standard template available.')
  } else {
    recommended = 'advocate'
    rules.push('Contested matter that benefits from an advocate’s review.')
  }

  if (input.profile.urgency === 'immediate' && recommended !== 'emergency') {
    rules.push('Marked urgent — keep the advocate path available.')
  }

  const paths: TriagePath[] = [
    {
      key: 'self-help',
      title: 'Handle it yourself',
      description: 'Use a reviewed template, file it in the right forum, and track the response.',
      recommended: recommended === 'self-help',
      reason: 'Your matter looks routine and a standard template fits the facts.',
      cta: 'Open self-help tools',
      icon: 'file',
    },
    {
      key: 'legal-aid',
      title: 'Free legal aid',
      description: 'Check eligibility for a DLSA lawyer at no cost. Helpline 15100.',
      recommended: recommended === 'legal-aid',
      reason: 'Your stated income may qualify you for free representation.',
      cta: 'Check eligibility',
      icon: 'handshake',
    },
    {
      key: 'advocate',
      title: 'Speak to an advocate',
      description: 'Match with a verified advocate for your court, language and budget.',
      recommended: recommended === 'advocate',
      reason: 'The dispute is contested or time-critical, so professional review is safer.',
      cta: 'Find an advocate',
      icon: 'scale',
    },
    {
      key: 'emergency',
      title: 'Emergency help',
      description: 'Immediate helplines and rights information. Works without AI.',
      recommended: recommended === 'emergency',
      reason: 'The facts include an urgent safety concern.',
      cta: 'Open emergency help',
      icon: 'siren',
    },
  ]

  return { recommended, confidence: 0.87, rules, paths }
}

export async function getTriage(profile: CaseProfile, annualIncome?: number): Promise<TriageResult> {
  await delay(500)
  return runTriage({ profile, annualIncome })
}
