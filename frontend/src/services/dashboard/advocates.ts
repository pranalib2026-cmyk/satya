import { delay } from './api'
import { advocates, getAdvocate } from '@/data/dashboard-mock-data'
import type { Advocate, AdvocateMatch, Language, MatchScore } from '@/types/dashboard'

/** Weights come from the `config` table in the backend. */
export const configRows = [
  { key: 'matching.weight.practice_fit', value: '0.30' },
  { key: 'matching.weight.court_proximity', value: '0.20' },
  { key: 'matching.weight.experience', value: '0.15' },
  { key: 'matching.weight.language', value: '0.10' },
  { key: 'matching.weight.rating_response', value: '0.15' },
  { key: 'matching.weight.budget_availability', value: '0.10' },
] as const

export const weights = Object.fromEntries(
  configRows.map((r) => [r.key.split('.').pop()!, Number(r.value)]),
) as Record<'practice_fit' | 'court_proximity' | 'experience' | 'language' | 'rating_response' | 'budget_availability', number>

export interface MatchPreferences {
  practiceArea?: string
  budgetMax: number
  language: Language | 'any'
  mode: 'any' | 'video' | 'phone' | 'in-person'
  gender: 'any' | 'female' | 'male'
  city?: string
}

const norm = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (v - min) / (max - min)))

/**
 * Transparent matching. Reads NO payment field — fee is used only as the user's
 * budget constraint, never as a ranking boost.
 * TODO: port to backend/app/services/matching.py with advocates from SQLAlchemy.
 */
export function scoreAdvocate(adv: Advocate, prefs: MatchPreferences, category: string): AdvocateMatch {
  const areas = adv.practiceAreas.map((a) => a.toLowerCase())
  const practiceFit = areas.some((a) => a.includes(category.toLowerCase())) ? 1 : areas.some((a) => a === 'civil') ? 0.5 : 0.2

  const courtProximity = Math.max(0, 1 - adv.distanceKm / 25)
  const experience = norm(adv.experienceYears, 0, 25)
  const language =
    prefs.language === 'any' ? 0.8 : adv.languages.includes(prefs.language) ? 1 : 0.15
  const ratingResponse = (norm(adv.rating, 3.5, 5) + adv.responseRate / 100) / 2

  const withinBudget = adv.feeMin <= prefs.budgetMax
  const modeOk = prefs.mode === 'any' || adv.modes.includes(prefs.mode as 'video' | 'phone' | 'in-person')
  const budgetAvailability = (withinBudget ? 0.7 : 0.1) + (modeOk ? 0.3 : 0)

  const score: MatchScore = {
    practiceFit,
    courtProximity,
    experience,
    language,
    ratingResponse,
    budgetAvailability,
    total:
      weights.practice_fit * practiceFit +
      weights.court_proximity * courtProximity +
      weights.experience * experience +
      weights.language * language +
      weights.rating_response * ratingResponse +
      weights.budget_availability * budgetAvailability,
  }

  const reasonParts: string[] = []
  if (practiceFit === 1) reasonParts.push(`practises ${category.toLowerCase()}`)
  else reasonParts.push('has relevant civil practice')
  if (adv.courts.some((c) => c.toLowerCase().includes('bengaluru'))) reasonParts.push('appears in Bengaluru courts')
  if (prefs.language !== 'any' && adv.languages.includes(prefs.language)) reasonParts.push('speaks your language')
  if (withinBudget) reasonParts.push(`fees from ₹${adv.feeMin.toLocaleString('en-IN')}`)
  if (adv.distanceKm <= 8) reasonParts.push(`${adv.distanceKm} km away`)

  return {
    advocate: adv,
    score,
    reason: `Matches because this advocate ${reasonParts.join(', ')}.`,
  }
}

export async function matchAdvocates(
  prefs: MatchPreferences,
  category = 'Tenancy',
): Promise<{ matches: AdvocateMatch[]; noLocalMatch: boolean }> {
  await delay(800)
  const filtered = advocates.filter((adv) => adv.verified)

  const eligible = filtered.filter(
    (adv) =>
      (prefs.mode === 'any' || adv.modes.includes(prefs.mode as 'video' | 'phone' | 'in-person')) &&
      (prefs.gender === 'any' || adv.gender === prefs.gender),
  )

  const ranked = eligible
    .map((adv) => scoreAdvocate(adv, prefs, category))
    .sort((a, b) => b.score.total - a.score.total)

  const local = ranked.filter((m) => m.advocate.distanceKm <= 20 && m.advocate.feeMin <= prefs.budgetMax)

  if (local.length === 0) {
    const remote = ranked
      .filter((m) => m.advocate.modes.includes('video') || m.advocate.modes.includes('phone'))
      .slice(0, 5)
    return { matches: remote, noLocalMatch: true }
  }

  return { matches: local.slice(0, 5), noLocalMatch: false }
}

export async function getAdvocateById(id: string): Promise<Advocate | undefined> {
  await delay(300)
  return getAdvocate(id)
}

export function sortMatches(matches: AdvocateMatch[], sort: 'recommended' | 'nearest' | 'fee' | 'experience') {
  const list = [...matches]
  switch (sort) {
    case 'nearest':
      return list.sort((a, b) => a.advocate.distanceKm - b.advocate.distanceKm)
    case 'fee':
      return list.sort((a, b) => a.advocate.feeMin - b.advocate.feeMin)
    case 'experience':
      return list.sort((a, b) => b.advocate.experienceYears - a.advocate.experienceYears)
    default:
      return list.sort((a, b) => b.score.total - a.score.total)
  }
}

export const practiceAreas = ['Tenancy', 'Property', 'Consumer', 'Cheque bounce', 'Family', 'Criminal', 'Employment', 'Cyber']
