import { DISCLAIMER, delay } from './api'
import { citations as citationBank, cases } from '@/data/dashboard-mock-data'
import type { Citation, Message } from '@/types/dashboard'

const c = citationBank

const starterMessages: Message[] = [
  {
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'user',
    content:
      'My landlord is not returning my ₹60,000 security deposit after I vacated the flat in HSR Layout. He says I damaged the paint.',
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: 'msg_2',
    conversationId: 'conv_1',
    role: 'assistant',
    content:
      'Thank you for explaining. Based on what you have shared, this looks like a tenancy deposit dispute.\n\nIn plain language: a security deposit is your money held by the landlord. Once the lease ends and you hand over the property, it should be returned, minus any proven damage beyond normal wear and tear. A general claim of “paint damage” usually needs an inspection report or photos taken at handover to justify a deduction.\n\nYour likely next steps are: (1) send a written demand, (2) keep proof of handover and payment, and (3) if there is no reply, approach the Rent Controller or civil court.',
    citations: [c.tenancy, c.rent],
    disclaimer: DISCLAIMER,
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
]

export async function getConversation(): Promise<Message[]> {
  await delay(250)
  return starterMessages
}

const answerFor = (text: string): { body: string; picks: Citation[] } => {
  const t = text.toLowerCase()
  if (/cheque|bounce|138/.test(t)) {
    return {
      body:
        'A dishonoured cheque can lead to a criminal complaint under Section 138 of the Negotiable Instruments Act, 1881. The timeline is strict: a written demand notice must go to the drawer within 30 days of receiving the bank’s return memo. The drawer then has 15 days to pay. If they do not, a complaint can be filed within one month after that.\n\nKeep the original cheque, the return memo and proof of the transaction. Because the notice window can close quickly, this is a matter where an advocate should review the papers soon.',
      picks: [c.cheque, c.consumer],
    }
  }
  if (/salary|employer|job|terminat/.test(t)) {
    return {
      body:
        'Unpaid salary or wrongful termination is usually handled first through a written demand, then before the Labour Court or the authority notified for your establishment. Keep your appointment letter, salary slips, attendance records and any written communication about the termination.\n\nThe limitation period depends on the claim and the forum, so it should be confirmed against your documents before you rely on a date.',
      picks: [c.consumer, c.cheque],
    }
  }
  if (/divorce|maintenance|husband|wife|domestic/.test(t)) {
    return {
      body:
        'Family matters such as maintenance or protection from domestic violence can be brought before the Family Court or a Magistrate. There is no court fee for many family applications, and free legal aid is available to women and children through the District Legal Services Authority.\n\nIf there is immediate danger, please use the Emergency page. It works without an AI call and lists helplines 112 and 181.',
      picks: [c.consumer, c.tenancy],
    }
  }
  if (/police|fir|arrest/.test(t)) {
    return {
      body:
        'If the police refuse to register an FIR for a cognizable offence, you can write to the Superintendent of Police, and if that fails, approach the Magistrate. For an arrest, the person must be informed of the grounds, allowed to consult a lawyer, and produced before a Magistrate within 24 hours.\n\nIn an emergency, call 112 immediately. The Emergency page in this app works without any AI call.',
      picks: [c.criminal, c.cheque],
    }
  }
  return {
    body:
      'Based on what you have described, the first question is whether the other side has a legal obligation that is clear from a document. If yes, a written demand is usually the cheapest first step. If the obligation is disputed, a court or tribunal may need to decide it.\n\nKeep copies of every agreement, payment record and message. Deadlines matter: limitation periods can end a claim even when the facts are strong. I can help you organise the facts into a case profile, or you can speak with an advocate.',
    picks: [c.tenancy, c.consumer],
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Mock streaming chat. Emits chunks to simulate SSE/token streaming.
 * TODO: replace with the FastAPI /chat/stream endpoint (SSE).
 * Every answer must be written to audit_logs by the backend.
 */
export async function streamAnswer(
  question: string,
  onChunk: (chunk: string) => void,
): Promise<{ message: Message }> {
  const { body, picks } = answerFor(question)
  const words = body.split(' ')
  for (let i = 0; i < words.length; i += 3) {
    await sleep(38)
    onChunk(words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : ''))
  }
  const message: Message = {
    id: `msg_${Date.now()}`,
    conversationId: 'conv_1',
    role: 'assistant',
    content: body,
    citations: picks,
    disclaimer: DISCLAIMER,
    createdAt: new Date().toISOString(),
  }
  // Mock audit log. TODO: backend writes {prompt, sources, answer, userId} to audit_logs.
  console.info('[audit] chat answer logged', { question, sources: picks.map((p) => p.section) })
  return { message }
}

export function starterCase() {
  return cases[0]
}
