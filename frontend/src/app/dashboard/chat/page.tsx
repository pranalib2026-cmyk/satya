"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Mic,
  Paperclip,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { getConversation, streamAnswer } from "@/services/dashboard/chat";
import type { Message } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, PageLoader } from "@/components/dashboard/ui";
import { CitationChip, Disclaimer } from "@/components/dashboard/shared";
import { useAuth } from "@/lib/auth-context";
import { dh } from "@/lib/dashboard-utils";

const suggestions = [
  'What are my options if a cheque bounces?',
  'How long do I have to reply to a legal notice?',
  'My employer has not paid my salary.',
];

function Typing() {
  return (
    <div className="flex items-center gap-1 rounded-full bg-card-bg px-3 py-2">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="ml-1.5 text-[11.5px] text-muted">Reading the law…</span>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand text-card-bg">
          <Sparkles className="size-4" aria-hidden />
        </span>
      )}
      <div className={cn('max-w-[86%] sm:max-w-[78%]', isUser && 'order-first')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[13.5px] leading-6 whitespace-pre-wrap',
            isUser
              ? 'rounded-br-md bg-brand text-card-bg'
              : 'rounded-bl-md border border-line bg-card-bg text-ink shadow-sm',
          )}
        >
          {message.content}
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted">
              <BookOpen className="size-3" aria-hidden /> Sources
            </span>
            {message.citations.map((c) => (
              <CitationChip key={c.id} citation={c} />
            ))}
          </div>
        )}
        {!isUser && message.disclaimer && (
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-4 text-muted">
            <ShieldCheck className="mt-px size-3 shrink-0" aria-hidden />
            {message.disclaimer}
          </p>
        )}
        {isUser && (
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
            <span className="size-1.5 rounded-full bg-dot" aria-hidden /> Delivered
          </span>
        )}
      </div>
      {isUser && <Avatar initials="RK" size="sm" tone="neutral" className="mt-0.5" />}
    </div>
  )
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <ChatContent />
    </React.Suspense>
  );
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const initialQuestion = searchParams.get('question')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [partial, setPartial] = useState('')
  const [busy, setBusy] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    void getConversation().then((msgs) => {
      setMessages(msgs)
      setBusy(false)
    })
  }, [])

  useEffect(() => {
    const el = endRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, partial, streaming, busy])

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || streaming) return
    setInput('')
    setMessages((m) => [
      ...m,
      {
        id: `msg_${Date.now()}`,
        conversationId: 'conv_1',
        role: 'user',
        content: clean,
        createdAt: new Date().toISOString(),
      },
    ])
    setStreaming(true)
    setPartial('')
    try {
      const { message } = await streamAnswer(clean, (chunk) => setPartial((p) => p + chunk))
      setMessages((m) => [...m, message])
    } finally {
      setPartial('')
      setStreaming(false)
    }
  }

  useEffect(() => {
    if (!busy && initialQuestion && !started.current) {
      started.current = true
      void send(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, initialQuestion])

  return (
    <div className="animate-fade">
      {/* Chat header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-brand text-card-bg shadow-card">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[20px] leading-tight font-extrabold">AI legal assistant</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-body">
              <span className="size-1.5 rounded-full bg-dot" aria-hidden />
              Answers with sources · English, हिन्दी, ಕನ್ನಡ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="mint">
            <ShieldCheck className="size-3" aria-hidden /> Guardrails on
          </Badge>
          <Button size="sm" variant="secondary" onClick={() => router.push(dh('/intake'))}>
            Guided intake
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Chat panel */}
        <section className="card flex h-[calc(100dvh-275px)] min-h-[460px] flex-col overflow-hidden lg:h-[calc(100dvh-220px)]">
          <div ref={endRef} className="flex-1 space-y-4 overflow-y-auto bg-brand-tint px-3.5 py-4 sm:px-5">
            {busy ? (
              <div className="space-y-3">
                <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-brand-tint" />
                <div className="ml-auto h-12 w-2/3 animate-pulse rounded-2xl bg-secondary-bg" />
                <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-brand-tint" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center">
                  <span className="rounded-full bg-card-bg px-3 py-1 text-[10.5px] font-medium text-muted shadow-sm">
                    Today · Conversation started
                  </span>
                </div>

                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}

                {streaming && (
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand text-card-bg">
                      <Sparkles className="size-4" aria-hidden />
                    </span>
                    <div className="max-w-[86%]">
                      {partial ? (
                        <div className="rounded-2xl rounded-bl-md border border-line bg-card-bg px-4 py-3 text-[13.5px] leading-6 whitespace-pre-wrap text-ink shadow-sm">
                          {partial}
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
                        </div>
                      ) : (
                        <Typing />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {!busy && !streaming && (
              <div className="rounded-2xl border border-brand/20 bg-brand-tint p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                  <Sparkles className="size-3.5 text-brand" aria-hidden />
                  Turn this into a case profile
                </p>
                <p className="mt-1 text-[11.5px] leading-5 text-body">
                  Five short questions to organise the facts, forum and deadlines.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => router.push(dh('/intake'))}>
                    Start guided intake <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push(dh('/advocates'))}>
                    Not sure? Talk to an advocate
                  </Button>
                </div>
              </div>
            )}

          </div>

          {/* Composer */}
          <div className="border-t border-line bg-card-bg px-3 py-3 sm:px-4">
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={streaming}
                  className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-body transition hover:border-brand/40 hover:text-ink disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
              className="flex items-end gap-2 rounded-2xl border border-line bg-card-bg p-1.5 focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10"
            >
              <button
                type="button"
                aria-label="Attach a document (coming soon)"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-brand-tint hover:text-ink"
              >
                <Paperclip className="size-4.5" aria-hidden />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder="Ask a legal question…"
                aria-label="Message the AI legal assistant"
                className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[13.5px] leading-5 focus:outline-none"
              />
              <button
                type="button"
                aria-label="Speak (coming soon)"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-brand-tint hover:text-ink"
              >
                <Mic className="size-4.5" aria-hidden />
              </button>
              <Button type="submit" size="sm" className="size-9 !rounded-xl !px-0" disabled={!input.trim() || streaming} aria-label="Send message">
                <Send className="size-4" aria-hidden />
              </Button>
            </form>
            <p className="mt-2 px-1 pr-14 text-[10px] leading-4 text-muted lg:pr-1">
              {user?.name ? `${user.name}, answers are legal information only and may be incomplete. ` : ''}
              Not legal advice. Not a lawyer–client relationship.
            </p>
          </div>
        </section>

        {/* Right rail */}
        <aside className="hidden space-y-4 lg:block">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13.5px] font-bold">How answers are built</h2>
              <Badge tone="outline">v1</Badge>
            </div>
            <ol className="mt-3 space-y-3">
              {[
                ['Retrieve', 'Verified Acts and reviewed FAQs are searched first.'],
                ['Compose', 'The answer uses only retrieved material.'],
                ['Cite', 'Act and section are shown as clickable chips.'],
                ['Log', 'Prompt, sources and answer are written to an audit log.'],
              ].map(([step, text], i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-dark">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[12px] font-bold text-ink">{step}</p>
                    <p className="text-[11px] leading-4.5 text-body">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-4">
            <h2 className="text-[13.5px] font-bold">When to stop chatting</h2>
            <ul className="mt-2.5 space-y-2 text-[11.5px] leading-5 text-body">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-dot" />
                A deadline is within 7 days.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-dot" />
                The other side has a lawyer.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-dot" />
                Someone’s safety is at risk.
              </li>
            </ul>
            <Button size="sm" variant="secondary" fullWidth className="mt-3" onClick={() => router.push(dh('/advocates'))}>
              <Scale className="size-4" aria-hidden /> Find an advocate
            </Button>
            <Link
              href={dh('/emergency')}
              className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-danger-soft text-[12px] font-bold text-danger hover:bg-danger-soft"
            >
              Emergency help
            </Link>
          </div>

          <Disclaimer variant="banner" />
        </aside>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted lg:hidden">
        <UserRound className="size-3.5" aria-hidden />
        Answers are logged for quality review. Never share passwords or OTPs.
      </div>
    </div>
  )
}
