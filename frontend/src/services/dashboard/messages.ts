import { delay } from './api'
import { advocateChat, threads } from '@/data/dashboard-mock-data'
import type { AdvocateChatMessage, FeedbackEntry, Thread } from '@/types/dashboard'

export async function listThreads(): Promise<Thread[]> {
  await delay(300)
  return threads
}

export async function getThreadMessages(threadId: string): Promise<AdvocateChatMessage[]> {
  await delay(350)
  return advocateChat.filter((m) => m.threadId === threadId)
}

/**
 * Mock send. The backend broadcasts over a WebSocket at /ws/messages/{thread_id}.
 * TODO: connect a real WebSocket client in the store.
 */
export async function sendMessage(threadId: string, text: string, attachmentName?: string) {
  await delay(400)
  const msg: AdvocateChatMessage = {
    id: `cm_${Date.now()}`,
    threadId,
    from: 'user',
    text,
    attachmentName,
    at: new Date().toISOString(),
  }
  // Mock advocate auto-reply (TODO: remove once the advocate dashboard exists).
  const reply: AdvocateChatMessage = {
    id: `cm_${Date.now() + 1}`,
    threadId,
    from: 'advocate',
    text: 'Received. I will review this and get back to you by the end of the day.',
    at: new Date(Date.now() + 1000).toISOString(),
  }
  return [msg, reply]
}

export async function submitFeedback(entry: Omit<FeedbackEntry, 'id' | 'createdAt'>) {
  await delay(700)
  return { ...entry, id: `fb_${Date.now()}`, createdAt: new Date().toISOString() } satisfies FeedbackEntry
}

export async function reportUser(threadId: string, reason: string) {
  await delay(500)
  console.info('[audit] conversation reported', { threadId, reason })
  return { ok: true }
}

export async function blockAdvocate(threadId: string) {
  await delay(400)
  console.info('[audit] advocate blocked', { threadId })
  return { ok: true }
}

/** Mock call masking. TODO: integrate a telephony provider with number masking. */
export async function callMaskedNumber(threadId: string) {
  await delay(600)
  return { ok: true, threadId, message: 'Calling you now. The advocate will see a masked number.' }
}
