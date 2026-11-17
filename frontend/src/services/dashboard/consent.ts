import { delay } from './api'
import type { Consent } from '@/types/dashboard'

const KEY = 'legal_consents'

const seed: Consent[] = [
  {
    id: 'cns_1',
    userId: 'usr_1024',
    consentType: 'terms',
    version: '1.0',
    grantedAt: new Date(Date.now() - 42 * 86400000).toISOString(),
    revoked: false,
  },
  {
    id: 'cns_2',
    userId: 'usr_1024',
    consentType: 'privacy',
    version: '1.0',
    grantedAt: new Date(Date.now() - 42 * 86400000).toISOString(),
    revoked: false,
  },
  {
    id: 'cns_3',
    userId: 'usr_1024',
    consentType: 'share_brief',
    version: '1.0',
    grantedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    revoked: false,
    purpose: 'Case brief review',
    advocateId: 'adv_1',
    itemsShared: ['Case brief', 'Rent Agreement 2024.pdf'],
  },
]

export function listConsents(): Consent[] {
  if (typeof window === 'undefined') return seed
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(seed))
    return seed
  }

  try {
    return JSON.parse(raw) as Consent[]
  } catch {
    return seed
  }
}

export async function saveConsent(consent: Omit<Consent, 'id' | 'grantedAt' | 'revoked'>): Promise<Consent> {
  await delay(300)
  const row: Consent = {
    ...consent,
    id: `cns_${Date.now()}`,
    grantedAt: new Date().toISOString(),
    revoked: false,
  }
  const all = [row, ...listConsents()]
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(all))
  // TODO: POST /consents -> consents(user_id, consent_type, version, timestamp)
  return row
}

export async function revokeConsent(id: string) {
  await delay(300)
  const all = listConsents().map((c) => (c.id === id ? { ...c, revoked: true } : c))
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(all))
  return all
}

const labels: Record<Consent['consentType'], string> = {
  terms: 'Terms of use',
  privacy: 'Privacy policy',
  dpdp: 'DPDP Act data processing consent',
  share_brief: 'Share case brief with advocate',
  share_documents: 'Share documents with advocate',
}

export const consentLabel = (type: Consent['consentType']) => labels[type]
