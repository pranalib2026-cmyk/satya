"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Clock,
  Flag,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  Video,
} from "lucide-react";
import {
  getThreadMessages,
  listThreads,
  sendMessage,
  markRead,
  callMaskedNumber,
  reportUser,
  blockAdvocate,
} from "@/services/dashboard/messages";
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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvocateChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState<"report" | "block" | null>(null);
  const [callNotice, setCallNotice] = useState("");
  const [query, setQuery] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load threads on mount
  useEffect(() => {
    let mounted = true;
    listThreads()
      .then((t) => {
        if (!mounted) return;
        setThreads(t);
        if (t.length > 0 && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
          setActiveId((prev) => prev ?? t[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Unable to load chambers threads";
        setErrorNotice(msg);
      })
      .finally(() => {
        if (mounted) setLoadingThreads(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Load messages and mark thread read when active thread changes
  useEffect(() => {
    if (!activeId) return;

    let isSubscribed = true;
    getThreadMessages(activeId)
      .then((msgs) => {
        if (isSubscribed) {
          setMessages(msgs);
          // Mark messages as read in backend
          void markRead(activeId).then(() => {
            if (isSubscribed) {
              setThreads((prev) =>
                prev.map((t) => (t.id === activeId ? { ...t, unread: 0 } : t)),
              );
            }
          });
        }
      })
      .catch((err: unknown) => {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : "Failed to retrieve conversation messages";
          setErrorNotice(msg);
        }
      })
      .finally(() => {
        if (isSubscribed) setLoadingMessages(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeId]);

  // Subtle real-time polling: fetch updates every 8 seconds for active thread
  useEffect(() => {
    if (!activeId) return;

    const interval = setInterval(async () => {
      try {
        const latest = await getThreadMessages(activeId);
        setMessages(latest);
        void markRead(activeId);
      } catch {
        // Silently ignore background polling transient errors
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [activeId]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loadingMessages]);

  const active = threads.find((t) => t.id === activeId);

  const send = async (attachmentName?: string) => {
    const text = attachmentName ? `Sharing a document: ${attachmentName}` : input.trim();
    if (!text || !activeId || sending) return;

    setInput("");
    setAttachOpen(false);
    setErrorNotice(null);

    const optimisticId = `tmp_${Date.now()}`;
    const optimistic: AdvocateChatMessage = {
      id: optimisticId,
      threadId: activeId,
      from: "user",
      text,
      attachmentName,
      at: new Date().toISOString(),
    };

    setMessages((m) => [...m, optimistic]);
    setSending(true);

    try {
      const sent = await sendMessage(activeId, text, attachmentName);
      setMessages((m) => [...m.filter((x) => x.id !== optimisticId), sent]);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, lastMessage: text, lastAt: sent.at } : t,
        ),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Message transmission failed. Please retry.";
      setErrorNotice(msg);
      // Remove optimistic message on failure so user knows it did not transmit
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter((t) =>
    t.advocateName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="CHAMBERS DISPATCH"
        title="Secure Communications"
        subtitle="Confidential privileged exchange channel between citizen and enrolled advocate. Vault records are transmitted strictly under explicit DPDP consent."
        actions={
          <Badge tone="mint">
            <ShieldCheck className="size-3 text-[#2a6b3b]" /> Privileged Channel · BSA Sec. 126
          </Badge>
        }
      />

      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3.5 flex items-start gap-3">
        <MessageSquare className="size-4 text-[#9a6a35] mt-0.5 shrink-0" />
        <div className="text-xs text-[#5b4a3b] leading-relaxed">
          <strong className="text-[#2a1c12] font-semibold">Authoritative Chambers Ledger:</strong> All communications in this channel are cryptographically verified and recorded in compliance with the Bharatiya Sakshya Adhiniyam, 2023 and Bar Council of India guidelines.
        </div>
      </div>

      {errorNotice && (
        <div className="rounded-[2px] border border-[#9a3424]/30 bg-[#9a3424]/10 p-3.5 flex items-center justify-between gap-3 text-xs text-[#9a3424]">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-[11px] font-mono uppercase underline hover:text-[#2a1c12]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] grid h-[calc(100dvh-260px)] min-h-[520px] overflow-hidden lg:h-[calc(100dvh-320px)] lg:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <aside className={cn("flex min-w-0 flex-col border-r border-[#e2d5c1] bg-[#fffaf2]", activeId && "hidden lg:flex")}>
          <div className="border-b border-[#e2d5c1] p-3.5 bg-[#ebe1d1]/20">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#85725f]" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search advocate threads…"
                className="h-9 pl-9 text-[12px] bg-[#fffaf2]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#e2d5c1]">
            {loadingThreads ? (
              <div className="p-8 text-center space-y-3">
                <Loader2 className="size-6 animate-spin mx-auto text-[#9a6a35]" />
                <p className="font-mono text-xs text-[#85725f]">Accessing chambers docket…</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageSquare className="size-6 mx-auto text-[#85725f]" />
                <p className="font-serif text-[14px] text-[#2a1c12]">No Conversations Found</p>
                <p className="font-mono text-[11px] text-[#85725f]">
                  {query ? "No threads match your query." : "Channels appear once you consult with an advocate."}
                </p>
                {!query && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 text-xs"
                    onClick={() => router.push(dh("/advocates"))}
                  >
                    Find an Advocate
                  </Button>
                )}
              </div>
            ) : (
              filteredThreads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "flex w-full min-w-0 gap-3 p-3.5 text-left transition-colors",
                    activeId === t.id ? "bg-[#ebe1d1]/40 border-l-2 border-l-[#2a1c12]" : "hover:bg-[#ebe1d1]/20",
                  )}
                >
                  <Avatar initials={t.initials} size="md" online={t.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-serif text-[14px] font-normal text-[#2a1c12]">Adv. {t.advocateName}</p>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[#85725f]">
                        {relativeDay(t.lastAt, today)}
                      </span>
                    </div>
                    <p className={cn("mt-0.5 truncate text-[12px]", t.unread > 0 ? "font-medium text-[#2a1c12]" : "text-[#5b4a3b]")}>
                      {t.lastMessage}
                    </p>
                    {t.unread > 0 && activeId !== t.id && (
                      <span className="mt-1.5 inline-grid h-4 min-w-4 place-items-center rounded-[2px] bg-[#2a1c12] px-1 font-mono text-[9px] font-medium text-[#fffaf2]">
                        {t.unread}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#e2d5c1] p-3.5 bg-[#ebe1d1]/10">
            <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-[#85725f]">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#2a6b3b]" aria-hidden />
              Privileged channel under BCI rules. Never transmit passwords or financial OTPs.
            </p>
          </div>
        </aside>

        {/* Conversation View */}
        {!active ? (
          <div className="hidden flex-col items-center justify-center text-center lg:flex p-6">
            <MessageSquare className="size-8 text-[#85725f]" aria-hidden />
            <h3 className="mt-3 font-serif text-[18px] font-normal text-[#2a1c12]">Select a Chambers Thread</h3>
            <p className="mt-1 font-mono text-[11px] text-[#85725f]">
              Select an enrolled advocate from the roll on the left to review communication.
            </p>
          </div>
        ) : (
          <section className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3 border-b border-[#e2d5c1] px-4 py-3 bg-[#ebe1d1]/20">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] text-[#2a1c12] hover:bg-[#fffaf2] lg:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="size-4" />
              </button>
              <Avatar initials={active.initials} size="sm" online={active.online} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-[15px] font-normal text-[#2a1c12]">Adv. {active.advocateName}</h3>
                <p className="flex items-center gap-1.5 font-mono text-[10px] text-[#85725f]">
                  <span className={cn("size-1.5 rounded-full", active.online ? "bg-[#2a6b3b]" : "bg-[#85725f]")} aria-hidden />
                  {active.online ? "Chambers Active" : "Typically replies within 1 court day"} · Live Protocol
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await callMaskedNumber(active.id);
                    setCallNotice(res.message);
                  }}
                  className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:border-[#9a6a35] transition-colors"
                  aria-label="Call via masked number"
                  title="Call via masked number"
                >
                  <PhoneCall className="size-3.5 text-[#9a6a35]" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(dh(`/booking/${active.advocateId || "adv_1"}`))}
                  className="hidden size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:border-[#9a6a35] transition-colors sm:grid"
                  aria-label="Book a consultation"
                  title="Book a consultation"
                >
                  <Video className="size-3.5 text-[#9a6a35]" />
                </button>
                <button
                  type="button"
                  onClick={() => setSafetyOpen("report")}
                  className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#85725f] hover:text-[#2a1c12] transition-colors"
                  aria-label="Report or block"
                >
                  <MoreVertical className="size-3.5" />
                </button>
              </div>
            </div>

            {callNotice && (
              <div className="flex items-center justify-between gap-2 border-b border-[#2a6b3b]/30 bg-[#2a6b3b]/10 px-4 py-2 font-mono text-[11px] font-medium text-[#2a6b3b]">
                {callNotice}
                <button
                  type="button"
                  onClick={() => setCallNotice("")}
                  className="text-[10px] uppercase tracking-wider underline hover:text-[#2a1c12]"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto bg-[#f4efe6]/60 p-4 sm:p-6">
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#85725f]">
                Privileged communication channel · Thread #{active.id.slice(0, 8)}
              </p>

              {loadingMessages ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="size-5 animate-spin mx-auto text-[#9a6a35]" />
                  <p className="font-mono text-[11px] text-[#85725f]">Retrieving secure dispatch log…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Clock className="size-6 mx-auto text-[#85725f]" />
                  <p className="font-serif text-[14px] text-[#2a1c12]">No Messages Exchanged Yet</p>
                  <p className="font-mono text-[11px] text-[#85725f]">
                    Record an initial inquiry below to begin privileged counsel correspondence.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.from === "user";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[82%]", mine && "text-right")}>
                        <div
                          className={cn(
                            "inline-block rounded-[2px] px-4 py-3 text-left text-[13px] leading-relaxed whitespace-pre-wrap",
                            mine
                              ? "bg-[#2a1c12] text-[#fffaf2]"
                              : "border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12]",
                          )}
                        >
                          {m.attachmentName && (
                            <span
                              className={cn(
                                "mb-2 flex items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 font-mono text-[11px]",
                                mine ? "bg-white/10 text-[#fffaf2]" : "border border-[#e2d5c1] bg-[#f4efe6] text-[#9a6a35]",
                              )}
                            >
                              <Paperclip className="size-3" aria-hidden /> {m.attachmentName}
                            </span>
                          )}
                          {m.text}
                        </div>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#85725f]">
                          {formatDateTime(m.at)} {mine && "· DELIVERED"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#e2d5c1] p-3 bg-[#fffaf2]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-center gap-2 rounded-[2px] border border-[#e2d5c1] p-1.5 bg-[#f4efe6] focus-within:border-[#9a6a35]"
              >
                <button
                  type="button"
                  onClick={() => setAttachOpen(true)}
                  className="grid size-9 shrink-0 place-items-center rounded-[2px] text-[#85725f] hover:bg-[#fffaf2] hover:text-[#2a1c12] transition-colors"
                  aria-label="Attach a document from your vault"
                >
                  <Paperclip className="size-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Record an inquiry or update for retained counsel…"
                  aria-label="Message"
                  disabled={sending}
                  className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-[#2a1c12] focus:outline-none placeholder:text-[#85725f] disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="size-9 !rounded-[2px] !p-0"
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden />}
                </Button>
              </form>
              <p className="mt-2 px-1 text-[10px] font-mono text-[#85725f]">
                Client-advocate privileged exchange. Call connections utilize secure telephonic relays.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Attach from vault */}
      <Modal
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        title="Attach Vault Document"
        description="Grants temporary 7-day cryptographic read authority to counsel. Revocable at any moment from your vault."
      >
        <div className="space-y-2.5">
          {documents.slice(0, 5).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void send(d.name)}
              className="flex w-full items-center gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3.5 text-left transition hover:border-[#9a6a35] hover:bg-[#ebe1d1]/30"
            >
              <Paperclip className="size-4 shrink-0 text-[#9a6a35]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[13px] font-normal text-[#2a1c12]">{d.name}</span>
                <span className="font-mono text-[10px] text-[#85725f]">{d.caseTitle}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Report / block */}
      <Modal
        open={!!safetyOpen}
        onClose={() => setSafetyOpen(null)}
        title={safetyOpen === "block" ? "Bar Counsel Communications" : "File Compliance Notice"}
        description="NyayaSetu grievance desk inspects all procedural irregularities. Blocking immediately severs inbound dispatches."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSafetyOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!active) return;
                if (safetyOpen === "report") await reportUser(active.id, "User reported from messages");
                if (safetyOpen === "block") {
                  await blockAdvocate(active.id);
                  setThreads((prev) => prev.filter((t) => t.id !== active.id));
                  setActiveId(null);
                }
                setSafetyOpen(null);
              }}
            >
              {safetyOpen === "block" ? (
                <>
                  <Ban className="size-4" /> Block Counsel
                </>
              ) : (
                <>
                  <Flag className="size-4" /> Submit Report
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-[#5b4a3b]">
            {safetyOpen === "block"
              ? "You will terminate message delivery from this advocate. Prior calendar bookings and court docket entries remain registered in your archive."
              : "Grievance notices remain strictly confidential between citizen and the administrative review committee. For emergency physical danger, dial 112 immediately."}
          </p>
          {safetyOpen === "report" && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setSafetyOpen("block")}
                className="font-mono text-[11px] uppercase tracking-wider text-[#9a3424] hover:underline"
              >
                Proceed to block this advocate instead
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
