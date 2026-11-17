"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Flag,
  Lock,
  MessageSquare,
  MoreVertical,
  Paperclip,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  Video,
} from "lucide-react";
import { getThreadMessages, listThreads, sendMessage, callMaskedNumber, reportUser, blockAdvocate } from "@/services/dashboard/messages";
import { documents } from "@/data/dashboard-mock-data";
import type { AdvocateChatMessage, Thread } from "@/types/dashboard";
import { formatDateTime, relativeDay, dh } from "@/lib/dashboard-utils";
import { useDashboardToday } from "@/lib/dashboard-time";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, Input, Modal } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";

export default function MessagesPage() {
  const router = useRouter();
  const today = useDashboardToday();
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AdvocateChatMessage[]>([])
  const [input, setInput] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState<'report' | 'block' | null>(null)
  const [callNotice, setCallNotice] = useState('')
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void listThreads().then((t) => {
      setThreads(t)
      if (window.matchMedia('(min-width: 1024px)').matches) setActiveId(t[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (activeId) void getThreadMessages(activeId).then(setMessages)
  }, [activeId])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const active = threads.find((t) => t.id === activeId)

  const send = async (attachmentName?: string) => {
    const text = attachmentName ? `Sharing a document: ${attachmentName}` : input.trim()
    if (!text || !activeId) return
    setInput('')
    setAttachOpen(false)
    const optimistic: AdvocateChatMessage = {
      id: `tmp_${Date.now()}`,
      threadId: activeId,
      from: 'user',
      text,
      attachmentName,
      at: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])
    setTyping(true)
    const [sent, reply] = await sendMessage(activeId, text, attachmentName)
    setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), sent])
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [...m, reply])
    }, 700)
  }

  const filteredThreads = threads.filter((t) => t.advocateName.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Secure messaging"
        title="Messages"
        subtitle="Talk to your advocate without sharing your phone number. Files are shared from your vault with consent."
        actions={<Badge tone="mint"><Lock className="size-3" /> Encrypted · mock</Badge>}
      />

      <div className="card grid h-[calc(100dvh-260px)] min-h-[520px] overflow-hidden lg:h-[calc(100dvh-320px)] lg:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <aside className={cn('flex min-w-0 flex-col border-r border-line', activeId && 'hidden lg:flex')}>
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="h-9 pl-9 text-[12px]" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  'flex w-full min-w-0 gap-3 border-b border-line/70 p-3 text-left transition hover:bg-brand-tint',
                  activeId === t.id && 'bg-brand-tint/60',
                )}
              >
                <Avatar initials={t.initials} size="md" online={t.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-bold text-ink">Adv. {t.advocateName}</p>
                    <span className="shrink-0 text-[9.5px] text-muted">{relativeDay(t.lastAt, today)}</span>
                  </div>
                  <p className={cn('mt-0.5 truncate text-[11px]', t.unread > 0 ? 'font-semibold text-ink' : 'text-body')}>
                    {t.lastMessage}
                  </p>
                  {t.unread > 0 && activeId !== t.id && (
                    <span className="mt-1 inline-grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-card-bg">
                      {t.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-line p-3">
            <p className="flex items-start gap-1.5 text-[10px] leading-4 text-muted">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-dot" aria-hidden />
              Messages are visible to the advocate and our grievance team on report. Never share OTPs.
            </p>
          </div>
        </aside>

        {/* Conversation */}
        {!active ? (
          <div className="hidden flex-col items-center justify-center text-center lg:flex">
            <MessageSquare className="size-8 text-muted" aria-hidden />
            <p className="mt-2 text-[13px] font-semibold">Select a conversation</p>
          </div>
        ) : (
          <section className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
              <button type="button" onClick={() => setActiveId(null)} className="grid size-8 place-items-center rounded-lg text-body hover:bg-brand-tint lg:hidden" aria-label="Back to conversations">
                <ArrowLeft className="size-4" />
              </button>
              <Avatar initials={active.initials} size="sm" online={active.online} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold">Adv. {active.advocateName}</p>
                <p className="flex items-center gap-1 text-[10px] text-muted">
                  <span className={cn('size-1.5 rounded-full', active.online ? 'bg-dot' : 'bg-border-hover')} aria-hidden />
                  {active.online ? 'Online now' : 'Usually replies within a day'} · live via WebSocket (mock)
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await callMaskedNumber(active.id)
                    setCallNotice(res.message)
                  }}
                  className="grid size-8 place-items-center rounded-lg text-body hover:bg-brand-tint hover:text-ink"
                  aria-label="Call via masked number"
                  title="Call via masked number"
                >
                  <PhoneCall className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(dh('/booking/adv_1'))}
                  className="hidden size-8 place-items-center rounded-lg text-body hover:bg-brand-tint hover:text-ink sm:grid"
                  aria-label="Book a video consultation"
                  title="Book a consultation"
                >
                  <Video className="size-4" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSafetyOpen('report')}
                    className="grid size-8 place-items-center rounded-lg text-body hover:bg-brand-tint hover:text-ink"
                    aria-label="Report or block"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {callNotice && (
              <div className="flex items-center justify-between gap-2 border-b border-line bg-mint-soft px-3 py-2 text-[11px] font-medium text-dot">
                {callNotice}
                <button type="button" onClick={() => setCallNotice('')} className="text-[10px] underline">Dismiss</button>
              </div>
            )}

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-brand-tint px-3 py-4">
              <p className="text-center text-[9.5px] font-medium text-muted">
                Conversation started from your {active.id === 'th_1' ? 'tenancy' : 'case'} matter · masked numbers
              </p>
              {messages.map((m) => {
                const mine = m.from === 'user'
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[82%]', mine && 'text-right')}>
                      <div
                        className={cn(
                          'inline-block rounded-2xl px-3.5 py-2.5 text-left text-[12.5px] leading-5 whitespace-pre-wrap',
                          mine ? 'rounded-br-md bg-brand text-card-bg' : 'rounded-bl-md border border-line bg-card-bg text-ink',
                        )}
                      >
                        {m.attachmentName && (
                          <span className={cn('mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold', mine ? 'bg-card-bg/15' : 'bg-brand-soft text-brand-dark')}>
                            <Paperclip className="size-3" aria-hidden /> {m.attachmentName}
                          </span>
                        )}
                        {m.text}
                      </div>
                      <p className="mt-1 text-[9px] text-muted">{formatDateTime(m.at)} {mine && '· Delivered'}</p>
                    </div>
                  </div>
                )
              })}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-line bg-card-bg px-3 py-2">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-line p-2.5">
              <form
                onSubmit={(e) => { e.preventDefault(); void send() }}
                className="flex items-center gap-1.5 rounded-xl border border-line p-1 focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10"
              >
                <button type="button" onClick={() => setAttachOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-brand-tint hover:text-ink" aria-label="Attach a document from your vault">
                  <Paperclip className="size-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write a message…"
                  aria-label="Message"
                  className="h-9 min-w-0 flex-1 bg-transparent px-1 text-[12.5px] focus:outline-none"
                />
                <Button type="submit" size="sm" className="size-9 !rounded-lg !px-0" disabled={!input.trim()} aria-label="Send">
                  <Send className="size-4" aria-hidden />
                </Button>
              </form>
              <p className="mt-1.5 px-1 pr-14 text-[9.5px] text-muted lg:pr-1">
                Do not share bank details, OTPs or passwords. Call is routed through a masked number.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Attach from vault */}
      <Modal
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        title="Attach from vault"
        description="The advocate can view the file for 7 days. You can revoke access from the vault."
      >
        <div className="space-y-2">
          {documents.slice(0, 5).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void send(d.name)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-line p-3 text-left transition hover:border-brand/40 hover:bg-brand-tint/40"
            >
              <Paperclip className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">{d.name}</span>
                <span className="text-[10px] text-muted">{d.caseTitle}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Report / block */}
      <Modal
        open={!!safetyOpen}
        onClose={() => setSafetyOpen(null)}
        title={safetyOpen === 'block' ? 'Block this advocate' : 'Report a problem'}
        description="Our grievance team reviews every report. Blocking stops new messages."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSafetyOpen(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!active) return
                if (safetyOpen === 'report') await reportUser(active.id, 'User reported from messages')
                if (safetyOpen === 'block') await blockAdvocate(active.id)
                setSafetyOpen(null)
              }}
            >
              {safetyOpen === 'block' ? <><Ban className="size-4" /> Block</> : <><Flag className="size-4" /> Submit report</>}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-5 text-body">
            {safetyOpen === 'block'
              ? 'You will no longer receive messages from this advocate. Existing bookings are not cancelled.'
              : 'Reports are confidential. For an emergency, call 112 instead of reporting here.'}
          </p>
          {safetyOpen === 'report' && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setSafetyOpen('block')} className="text-[11px] font-semibold text-danger hover:underline">
                I want to block this advocate instead
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
