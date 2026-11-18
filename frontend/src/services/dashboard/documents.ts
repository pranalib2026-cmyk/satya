import { DISCLAIMER, delay } from './api'
import { dateOnly, documents, documentShares, accessLogs } from '@/data/dashboard-mock-data'
import type { AccessLog, DocumentExplanation, DocumentShare, OcrResult, VaultDocument } from '@/types/dashboard'

/**
 * Mock storage provider.
 * TODO: swap for S3/GCS with server-side encryption and short-lived signed URLs.
 */
export const storage = {
  async upload(file: File): Promise<{ id: string }> {
    await delay(700)
    return { id: `doc_${Date.now()}_${file.name.slice(0, 6)}` }
  },
  signedUrl(documentId: string, seconds = 300): string {
    const token = btoa(`${documentId}:${Date.now() + seconds * 1000}`)
    return `https://files.legal.local/${documentId}?token=${token}`
  },
}

/**
 * Mock OCR provider.
 * TODO: integrate an Indic-language OCR provider (e.g. cloud OCR or PaddleOCR).
 */
export async function runOcr(fileName: string): Promise<OcrResult> {
  await delay(1400)
  const lowConfidence = /blur|photo|scan|receipt/i.test(fileName)
  return {
    text:
      'LEGAL NOTICE\n\nTo, Mr. S. Rao, 402, Lake View Apartments, HSR Layout, Bengaluru 560102.\n\nUnder the terms of the lease dated 12 March 2024, the security deposit of Rs. 60,000 was payable within 15 days of handover. Our client vacated the premises on 15 September 2026 and returned all keys. Despite reminders, the amount has not been refunded.\n\nYou are called upon to pay Rs. 60,000 within 15 days of this notice, failing which legal proceedings will be initiated.\n\nDated: 2 October 2026\nIssued by: M/s Rao & Associates',
    confidence: lowConfidence ? 0.61 : 0.93,
    lowConfidence,
  }
}

export async function explainDocument(_text: string): Promise<DocumentExplanation> {
  await delay(1200)
  void _text
  // TODO: replace with LLM + retrieval. Response is always labelled as information.
  return {
    documentType: 'Legal notice (demand for refund of security deposit)',
    summary:
      'This is a formal demand sent to a landlord asking for a ₹60,000 security deposit to be returned. It says the tenant vacated the flat, returned the keys, and the deposit was not refunded despite reminders. It gives 15 days to pay before court action.',
    parties: ['Mr. S. Rao — recipient (landlord)', 'Rahul Kumar — tenant (you)', 'M/s Rao & Associates — issuing advocates'],
    dates: [
      { label: 'Lease date', value: '12 March 2024' },
      { label: 'Vacation / handover', value: '15 September 2026' },
      { label: 'Notice date', value: '2 October 2026' },
      { label: 'Payment deadline', value: '17 October 2026 (15 days from notice)' },
    ],
    amounts: [{ label: 'Security deposit claimed', value: '₹60,000' }],
    obligations: [
      'Pay ₹60,000 within 15 days of the notice date.',
      'Reply in writing to the issuing advocates if you dispute the claim.',
    ],
    risks: [
      'If the deadline passes without payment or reply, a civil claim may follow.',
      'Late reply can weaken your position, so respond before the deadline.',
      'The notice mentions only paint damage — ask for the inspection report if you dispute it.',
    ],
    disclaimer: DISCLAIMER,
  }
}

export const signedUrl = storage.signedUrl

export async function listDocuments(): Promise<VaultDocument[]> {
  await delay(400)
  return documents
}

export async function getAccessLogs(documentId: string): Promise<AccessLog[]> {
  await delay(250)
  return accessLogs.filter((l) => l.documentId === documentId)
}

export async function getShares(documentId: string): Promise<DocumentShare[]> {
  await delay(200)
  return documentShares.filter((s) => s.documentId === documentId)
}

export async function createShare(documentId: string, advocateId: string, advocateName: string, days: number) {
  await delay(600)
  return {
    id: `shr_${Date.now()}`,
    documentId,
    advocateId,
    advocateName,
    expiresAt: dateOnly(days),
    revoked: false,
  } satisfies DocumentShare
}

/** Mock SMS / reminder dispatch. TODO: WhatsApp Business API or SMS provider. */
export async function sendMockSms(to: string, body: string) {
  await delay(200)
  console.info('[mock-sms]', { to, body })
  return { sent: true }
}
