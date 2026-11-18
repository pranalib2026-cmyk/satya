"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  FileText,
  FolderLock,
  MessagesSquare,
  Mic,
  ScanLine,
  Scale,
  Sparkles,
  Stethoscope,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDashboardSummary } from "@/services/dashboard/dashboard";
import { daysUntil } from "@/services/dashboard/deadlines";
import type { DashboardSummary } from "@/types/dashboard";
import { dh, formatDate, relativeDay } from "@/lib/dashboard-utils";
import { useDashboardToday } from "@/lib/dashboard-time";
import { StatCard } from "@/components/dashboard/shared";
import { Button, Badge, SkeletonCard } from "@/components/dashboard/ui";
import { Disclaimer, ServiceError } from "@/components/dashboard/shared";

const QUICK_ACTIONS: Array<{
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { to: "/chat", label: "Ask the assistant", desc: "Explain my problem", icon: Sparkles, tone: "bg-brand-soft text-brand" },
  { to: "/scan", label: "Scan a document", desc: "Understand a notice", icon: ScanLine, tone: "bg-mint text-dot" },
  { to: "/advocates", label: "Find an advocate", desc: "Matched to your case", icon: Scale, tone: "bg-brand-soft text-brand" },
  { to: "/self-help", label: "Self-help tools", desc: "Templates & checklists", icon: FileText, tone: "bg-mint text-dot" },
  { to: "/deadlines", label: "Deadlines", desc: "Never miss a date", icon: CalendarClock, tone: "bg-brand-soft text-brand" },
  { to: "/cases", label: "My cases", desc: "Track progress", icon: FolderLock, tone: "bg-mint text-dot" },
];

export default function HomePage() {
  const router = useRouter();
  const today = useDashboardToday();
  const todayLabel = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const lastReviewed = formatDate(today);
  const { user } = useAuth();
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [error, setError] = React.useState("");
  const [problem, setProblem] = React.useState("");

  const load = React.useCallback(() => {
    getDashboardSummary()
      .then((data) => {
        setSummary(data);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load your dashboard.")
      );
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const start = () => {
    const question = problem.trim();
    if (!question) {
      router.push(dh("/chat"));
      return;
    }
    router.push(`${dh("/chat")}?question=${encodeURIComponent(question)}`);
  };

  const nextDeadline = summary?.deadlines[0];
  const nextDeadlineDays = nextDeadline ? daysUntil(nextDeadline.date, today) : null;
  const nextDeadlineLabel =
    nextDeadlineDays === null || nextDeadlineDays < 0
      ? "—"
      : nextDeadlineDays === 0
        ? "Today"
        : `${nextDeadlineDays} day${nextDeadlineDays === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6 animate-fade">
      {/* Greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <Sun className="size-3.5" aria-hidden="true" /> {todayLabel}
          </p>
          <h1 className="text-[27px] leading-tight font-extrabold sm:text-[32px]">
            Namaste, {user?.name?.split(" ")[0] ?? "Rahul"}
          </h1>
          <p className="mt-1.5 text-[14px] text-body">What would you like help with today?</p>
        </div>
        <Link
          href={dh("/deadlines")}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-warn-soft px-3.5 text-[12px] font-bold text-warn"
        >
          <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
          {summary
            ? `${summary.deadlines.filter((d) => !d.confirmed).length} dates need confirmation`
            : "Checking deadlines…"}
        </Link>
      </div>

      {error && <ServiceError message={error} onRetry={load} className="mb-4" />}

      {/* Describe your problem */}
      <section className="relative overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand-tint via-card-bg to-mint-soft/60 p-5 shadow-card sm:p-7">
        <div className="pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-brand/5" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-card-bg shadow-[0_2px_10px_rgb(42_28_18_/_0.3)]">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[17px] font-extrabold sm:text-[19px]">Describe your problem</h2>
              <p className="text-[12px] text-body">In your own words. English, हिन्दी or ಕನ್ನಡ.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card-bg p-2 shadow-sm transition focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              rows={3}
              placeholder="Tell us what happened, in your own words. For example: my landlord is not returning my security deposit…"
              className="w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 text-ink placeholder:text-muted/70 focus:outline-none"
              aria-label="Describe your problem"
            />
            <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
              <button
                type="button"
                aria-label="Speak your problem (voice input coming soon)"
                title="Voice input — UI only for now"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-body transition hover:bg-brand-tint hover:text-ink"
              >
                <Mic className="size-4" aria-hidden="true" /> Speak
                <span className="rounded bg-secondary-bg px-1 py-0.5 text-[9px] font-bold text-muted">SOON</span>
              </button>
              <Button size="md" onClick={start}>
                Get guidance
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] font-medium text-muted">Try:</span>
            {["My security deposit is not refunded", "A cheque bounced", "I received a legal notice"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setProblem(s)}
                className="cursor-pointer rounded-full border border-line bg-card-bg/80 px-2.5 py-1 text-[11.5px] font-medium text-body transition hover:border-brand/40 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Summary */}
      <section aria-label="Your account summary">
        {!summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={FolderLock}
              label="Active cases"
              value={summary.activeCases}
              hint="Across 2 forums"
              tone="brand"
              onClick={() => router.push(dh("/cases"))}
            />
            <StatCard
              icon={CalendarClock}
              label="Next deadline"
              value={nextDeadlineLabel}
              hint={nextDeadline?.title ?? "No upcoming dates"}
              tone="danger"
              onClick={() => router.push(dh("/deadlines"))}
            />
            <StatCard
              icon={MessagesSquare}
              label="Unread messages"
              value={summary.unreadMessages}
              hint="2 advocates replied"
              tone="mint"
              onClick={() => router.push(dh("/messages"))}
            />
            <StatCard
              icon={Stethoscope}
              label="Pending actions"
              value={summary.pendingActions}
              hint="Confirm dates · review brief"
              tone="neutral"
              onClick={() => router.push(dh("/deadlines"))}
            />
          </div>
        )}
      </section>

      {/* Case + deadlines */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Your active case</p>
              <h2 className="mt-1.5 text-[18px] leading-snug font-bold">
                {summary?.recentCase.title ?? "Security deposit not refunded by landlord"}
              </h2>
            </div>
            <Badge tone="mint" className="shrink-0">
              <span className="size-1.5 rounded-full bg-dot" aria-hidden="true" /> Active
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Category", summary?.recentCase.category ?? "Tenancy"],
              ["Probable forum", "Rent Controller"],
              ["Updated", "2 days ago"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-tint px-3 py-2.5">
                <p className="text-[10.5px] font-semibold text-muted uppercase">{label}</p>
                <p className="mt-0.5 truncate text-[12.5px] font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="font-semibold text-body">Case progress</span>
              <span className="font-bold text-brand">Step 4 of 5</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary-bg">
              <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand to-brand-dark" />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-body">
              <span className="size-1.5 rounded-full bg-dot" aria-hidden="true" />
              Awaiting filing decision — book a review before the limitation date.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push(dh("/cases/case_2041/progress"))}>
              View case progress <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(dh("/brief"))}>
              Review case brief
            </Button>
            <Button size="sm" variant="ghost" onClick={() => router.push(dh("/advocates"))}>
              Find a specialist
            </Button>
          </div>
        </section>

        <section className="card flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">Next deadlines</h2>
            <Link href={dh("/deadlines")} className="text-[12px] font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>

          <ul className="mt-3 flex-1 divide-y divide-line">
            {(summary?.deadlines ?? []).map((d) => {
              const days = daysUntil(d.date, today);
              const urgent = days <= 4;
              return (
                <li key={d.id} className="flex gap-3 py-3 first:pt-1 last:pb-0">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl text-center ${urgent ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-dark"}`}
                  >
                    <span className="text-[14px] leading-none font-extrabold">{new Date(d.date).getDate()}</span>
                    <span className="text-[8.5px] font-bold uppercase">
                      {new Date(d.date).toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug font-semibold text-ink">{d.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {relativeDay(d.date, today)} · {d.basis}
                    </p>
                  </div>
                  {!d.confirmed && (
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warn" title="Needs confirmation" />
                  )}
                </li>
              );
            })}
          </ul>

          <Link
            href={dh("/deadlines")}
            className="mt-4 flex items-center justify-between rounded-xl bg-brand-tint px-3.5 py-2.5 text-[12px] font-semibold text-body transition hover:bg-brand-soft"
          >
            Confirm dates with an advocate
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-[16px] font-bold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              href={dh(a.to)}
              className="group flex flex-col rounded-2xl border border-line bg-card-bg p-3.5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-pop"
            >
              <span className={`mb-2.5 grid size-9 place-items-center rounded-xl ${a.tone}`}>
                <a.icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="text-[12.5px] leading-tight font-bold text-ink">{a.label}</span>
              <span className="mt-1 text-[10.5px] leading-4 text-muted">{a.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <Disclaimer
        text={`Last answer reviewed by an advocate on ${lastReviewed}. Legal information only — not legal advice.`}
      />
    </div>
  );
}
