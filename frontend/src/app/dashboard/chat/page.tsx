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
  "What are my options if a commercial cheque bounces under Sec 138?",
  "How long do I have to reply to an advocate legal notice?",
  "Landlord has withheld tenancy security deposit past 30 days.",
];

function Typing() {
  return (
    <div className="flex items-center gap-1.5 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2.5">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="ml-1 text-xs text-[#85725f]">Retrieving Bare Acts & Judicial Precedents…</span>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
          <Sparkles className="size-4" aria-hidden />
        </span>
      )}
      <div className={cn("max-w-[86%] sm:max-w-[78%]", isUser && "order-first")}>
        <div
          className={cn(
            "rounded-[2px] px-4.5 py-3.5 text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap select-text",
            isUser
              ? "bg-[#2a1c12] text-[#fffaf2] shadow-xs"
              : "border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] shadow-xs"
          )}
        >
          {message.content}
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-sans uppercase tracking-[0.1em] font-medium text-[#85725f]">
              <BookOpen className="size-3 text-[#9a6a35]" aria-hidden /> Statutory Citations:
            </span>
            {message.citations.map((c) => (
              <CitationChip key={c.id} citation={c} />
            ))}
          </div>
        )}
        {!isUser && message.disclaimer && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#85725f]">
            <ShieldCheck className="mt-0.5 size-3 text-[#9a6a35] shrink-0" aria-hidden />
            {message.disclaimer}
          </p>
        )}
        {isUser && (
          <span className="mt-1 flex items-center justify-end gap-1 text-[10.5px] font-mono text-[#85725f]">
            <span className="size-1.5 rounded-full bg-[#2e7d32]" aria-hidden /> Delivered
          </span>
        )}
      </div>
      {isUser && <Avatar initials="RK" size="sm" tone="neutral" className="mt-0.5" />}
    </div>
  );
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
  const initialQuestion = searchParams.get("question");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    void getConversation().then((msgs) => {
      setMessages(msgs);
      setBusy(false);
    });
  }, []);

  useEffect(() => {
    const el = endRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, partial, streaming, busy]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || streaming) return;
    setInput("");
    setMessages((m) => [
      ...m,
      {
        id: `msg_${Date.now()}`,
        conversationId: "conv_1",
        role: "user",
        content: clean,
        createdAt: new Date().toISOString(),
      },
    ]);
    setStreaming(true);
    setPartial("");
    try {
      const { message } = await streamAnswer(clean, (chunk) => setPartial((p) => p + chunk));
      setMessages((m) => [...m, message]);
    } finally {
      setPartial("");
      setStreaming(false);
    }
  };

  useEffect(() => {
    if (!busy && initialQuestion && !started.current) {
      started.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, initialQuestion]);

  return (
    <div className="space-y-6 animate-fade">
      {/* Editorial Header */}
      <div className="pb-5 border-b border-[#e2d5c1] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-serif text-[26px] sm:text-[30px] font-normal tracking-tight text-[#2a1c12] leading-tight">
              AI Legal Assistant
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5b4a3b]">
              <span className="size-1.5 rounded-full bg-[#2e7d32]" aria-hidden />
              Statutory answers with citations · Bare Acts, High Court & SC Rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="mint">
            <ShieldCheck className="size-3" aria-hidden /> Guardrails Active
          </Badge>
          <Button size="sm" variant="secondary" onClick={() => router.push(dh("/intake"))}>
            Structured Intake
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
        {/* Chat Panel */}
        <section className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] flex h-[calc(100dvh-275px)] min-h-[480px] flex-col overflow-hidden shadow-[0_1px_2px_rgba(42,28,18,0.04)] lg:h-[calc(100dvh-230px)]">
          <div ref={endRef} className="flex-1 space-y-4 overflow-y-auto bg-[#f4efe6]/40 px-4 py-5 sm:px-6">
            {busy ? (
              <div className="space-y-3">
                <div className="h-16 w-3/4 animate-pulse rounded-[2px] bg-[#ebe1d1]/50" />
                <div className="ml-auto h-12 w-2/3 animate-pulse rounded-[2px] bg-[#ebe1d1]/60" />
                <div className="h-24 w-4/5 animate-pulse rounded-[2px] bg-[#ebe1d1]/50" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center">
                  <span className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3 py-1 text-[10.5px] font-sans uppercase tracking-[0.1em] font-medium text-[#85725f]">
                    Today · Session Initialized
                  </span>
                </div>

                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}

                {streaming && (
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                      <Sparkles className="size-4" aria-hidden />
                    </span>
                    <div className="max-w-[86%]">
                      {partial ? (
                        <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-4.5 py-3.5 text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#2a1c12] shadow-xs">
                          {partial}
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#9a6a35] align-middle" />
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
              <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/35 p-4 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#2a1c12]">
                  <Sparkles className="size-3.5 text-[#9a6a35]" aria-hidden />
                  Organize into formal Case Matter Brief
                </p>
                <p className="text-xs text-[#5b4a3b] leading-relaxed">
                  Five structured questions to catalog facts, court jurisdiction, and statutory limitation dates.
                </p>
                <div className="pt-1.5 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" onClick={() => router.push(dh("/intake"))}>
                    Start Structured Intake <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push(dh("/advocates"))}>
                    Consult Verified Advocate
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[#e2d5c1] bg-[#fffaf2] px-4 py-3 sm:px-5">
            <div className="mb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={streaming}
                  className="shrink-0 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-2.5 py-1 text-[11px] font-medium text-[#5b4a3b] transition hover:border-[#9a6a35] hover:text-[#2a1c12] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-1.5 focus-within:border-[#9a6a35] focus-within:ring-1 focus-within:ring-[#9a6a35]"
            >
              <button
                type="button"
                aria-label="Attach document"
                className="grid size-9 shrink-0 place-items-center rounded-[2px] text-[#85725f] hover:bg-[#ebe1d1]/40 hover:text-[#2a1c12] transition"
              >
                <Paperclip className="size-4" aria-hidden />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="State your statutory inquiry or legal question…"
                aria-label="Message the AI legal assistant"
                className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs sm:text-sm leading-relaxed text-[#2a1c12] placeholder:text-[#85725f]/60 focus:outline-none"
              />
              <button
                type="button"
                aria-label="Voice input"
                className="grid size-9 shrink-0 place-items-center rounded-[2px] text-[#85725f] hover:bg-[#ebe1d1]/40 hover:text-[#2a1c12] transition"
              >
                <Mic className="size-4" aria-hidden />
              </button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="size-9 !px-0 rounded-[2px]"
                disabled={!input.trim() || streaming}
                aria-label="Send query"
              >
                <Send className="size-3.5" aria-hidden />
              </Button>
            </form>
            <p className="mt-2 text-[10.5px] leading-relaxed text-[#85725f]">
              {user?.name ? `${user.name}, ` : ""}
              Information retrieved from official gazetted Indian Bare Acts. Preliminary AI assessments do not create an advocate-client relationship.
            </p>
          </div>
        </section>

        {/* Right Rail */}
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2d5c1]/60">
              <h2 className="font-serif text-[17px] font-normal text-[#2a1c12]">Retrieval Engine</h2>
              <Badge variant="stamp">RAG v2</Badge>
            </div>
            <ol className="mt-3.5 space-y-3 text-xs">
              {[
                ["Retrieve", "Bare Acts, High Court & Supreme Court statutory rules are retrieved."],
                ["Filter", "Jurisdiction and temporal relevance verified against central statutes."],
                ["Cite", "Sections and gazette provisions surfaced with active source links."],
                ["Verify", "Deterministic guardrails prevent hallucinated legal advice."],
              ].map(([step, text], i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/60 font-mono text-[10px] font-bold text-[#2a1c12]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[#2a1c12]">{step}</p>
                    <p className="text-[#5b4a3b] leading-relaxed mt-0.5">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 shadow-[0_1px_2px_rgba(42,28,18,0.04)] space-y-3">
            <h2 className="font-serif text-[17px] font-normal text-[#2a1c12]">Advocate Consultation</h2>
            <ul className="space-y-2 text-xs text-[#5b4a3b] leading-relaxed">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#9a6a35]" />
                Limitation deadline within 7 days.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#9a6a35]" />
                Formal legal notice or summons received.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#9a6a35]" />
                Court petition drafting and Vakalatnama required.
              </li>
            </ul>
            <Button size="sm" variant="secondary" fullWidth onClick={() => router.push(dh("/advocates"))}>
              <Scale className="size-3.5 mr-1 text-[#9a6a35]" aria-hidden /> Match Roll Advocates
            </Button>
            <Link
              href={dh("/emergency")}
              className="flex h-9 items-center justify-center gap-1.5 rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#c0392b] hover:bg-[#c0392b] hover:text-[#fffaf2] transition-colors"
            >
              Emergency Helpline: 112 / 181
            </Link>
          </div>

          <Disclaimer variant="banner" />
        </aside>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#85725f] lg:hidden">
        <UserRound className="size-3.5 text-[#9a6a35]" aria-hidden />
        Inquiries are processed under DPDP Act, 2023 encryption. Never share OTPs or banking credentials.
      </div>
    </div>
  );
}
