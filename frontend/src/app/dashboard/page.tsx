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
import { cn } from "@/lib/utils";
import { StatCard, Disclaimer, ServiceError } from "@/components/dashboard/shared";
import { Button, SkeletonCard } from "@/components/dashboard/ui";

const QUICK_ACTIONS: Array<{
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}> = [
  { to: "/chat", label: "AI Legal Assistant", desc: "Structured problem breakdown", icon: Sparkles },
  { to: "/scan", label: "Scan Document", desc: "Notice & order extraction", icon: ScanLine },
  { to: "/advocates", label: "Find an Advocate", desc: "Roll-verified practitioners", icon: Scale },
  { to: "/self-help", label: "Self-Help Guides", desc: "Statutory steps & checklists", icon: FileText },
  { to: "/deadlines", label: "Court Deadlines", desc: "Limitation & filing tracker", icon: CalendarClock },
  { to: "/cases", label: "Matter Ledger", desc: "Active case proceedings", icon: FolderLock },
];

export default function HomePage() {
  const router = useRouter();
  const today = useDashboardToday();
  const todayLabel = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
        : `${nextDeadlineDays} Day${nextDeadlineDays === 1 ? "" : "s"}`;

  return (
    <div className="space-y-7 animate-fade">
      {/* Editorial Greeting Header */}
      <div className="pb-5 border-b border-[#e2d5c1] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.14em] font-medium text-[#85725f]">
            <Sun className="size-3.5 text-[#9a6a35]" aria-hidden="true" /> {todayLabel}
          </p>
          <h1 className="font-serif text-[32px] sm:text-[38px] font-normal tracking-[-0.035em] text-[#2a1c12] leading-tight">
            Namaste, {user?.name?.split(" ")[0] ?? "Rahul"}
          </h1>
          <p className="mt-1 text-xs sm:text-[14px] text-[#5b4a3b] leading-relaxed">
            Case assessment, limitation schedules, and verified advocate matching across Indian jurisdictions.
          </p>
        </div>
        <Link
          href={dh("/deadlines")}
          className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-[#e2d5c1] bg-[#fff8e7] px-3 text-[11px] font-sans uppercase tracking-[0.1em] font-semibold text-[#b54708] transition hover:border-[#cfbe9e]"
        >
          <span className="size-1.5 rounded-full bg-[#b54708]" aria-hidden="true" />
          {summary
            ? `${summary.deadlines.filter((d) => !d.confirmed).length} dates require confirmation`
            : "Reviewing calendar…"}
        </Link>
      </div>

      {error && <ServiceError message={error} onRetry={load} className="mb-4" />}

      {/* Describe your problem - Architectural Editorial Deed Panel */}
      <section className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-8 shadow-[0_4px_24px_rgba(42,28,18,0.04)]">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-[21px] sm:text-[23px] font-normal tracking-tight text-[#2a1c12]">
                Describe Your Legal Situation
              </h2>
              <p className="text-xs text-[#85725f]">
                Input facts in plain language · English, हिन्दी, or ಕನ್ನಡ.
              </p>
            </div>
          </div>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6]/50 p-2.5 transition focus-within:border-[#9a6a35] focus-within:bg-[#fffaf2]">
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
              placeholder="State the facts of your matter. For example: Landlord withheld ₹1.5 lakh deposit after premises vacated; statutory notice served under state tenancy rules…"
              className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-[#2a1c12] placeholder:text-[#85725f]/60 focus:outline-none"
              aria-label="Describe your problem"
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-1.5 border-t border-[#e2d5c1]/60">
              <button
                type="button"
                aria-label="Voice input"
                title="Voice input"
                className="inline-flex h-8 items-center gap-1.5 rounded-[2px] px-2.5 text-xs text-[#85725f] hover:text-[#2a1c12] hover:bg-[#ebe1d1]/40 transition"
              >
                <Mic className="size-3.5" aria-hidden="true" /> Audio
                <span className="rounded-[1px] border border-[#e2d5c1] px-1 py-0.2 text-[9px] font-mono text-[#85725f]">SOON</span>
              </button>
              <Button size="sm" variant="compound" onClick={start}>
                Evaluate Situation
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-[#5b4a3b]">
            <span className="text-[11px] font-sans uppercase tracking-[0.1em] text-[#85725f] mr-1">Precedents:</span>
            {["Security deposit withheld by lessor", "Negotiable Instruments Sec 138 notice", "Delayed builder possession refund"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setProblem(s)}
                className="cursor-pointer rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-2.5 py-1 text-[11px] font-medium text-[#5b4a3b] transition hover:border-[#9a6a35] hover:text-[#2a1c12]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Summary KPI Cards */}
      <section aria-label="Account Summary Metrics">
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
              label="Active Matters"
              value={summary.activeCases}
              hint="Enrolled across 2 court forums"
              onClick={() => router.push(dh("/cases"))}
            />
            <StatCard
              icon={CalendarClock}
              label="Next Limitation Date"
              value={nextDeadlineLabel}
              hint={nextDeadline?.title ?? "No immediate statutory bar"}
              onClick={() => router.push(dh("/deadlines"))}
            />
            <StatCard
              icon={MessagesSquare}
              label="Advocate Messages"
              value={summary.unreadMessages}
              hint="2 counsel responses received"
              onClick={() => router.push(dh("/messages"))}
            />
            <StatCard
              icon={Stethoscope}
              label="Pending Actions"
              value={summary.pendingActions}
              hint="Statutory timeline review required"
              onClick={() => router.push(dh("/deadlines"))}
            />
          </div>
        )}
      </section>

      {/* Active Matter Ledger + Deadlines Split */}
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <section className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#e2d5c1]/60">
            <div className="space-y-1">
              <span className="text-[10.5px] font-sans uppercase tracking-[0.14em] font-medium text-[#85725f]">
                Active Matter Ledger
              </span>
              <h2 className="font-serif text-[20px] sm:text-[22px] font-normal leading-snug text-[#2a1c12]">
                {summary?.recentCase.title ?? "Security deposit recovery under State Tenancy Act"}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-sans uppercase tracking-[0.12em] font-medium border border-[#e2d5c1] bg-[#dceada]/60 text-[#2e7d32] rounded-[2px] shrink-0">
              <span className="size-1.5 rounded-full bg-[#2e7d32]" aria-hidden="true" /> Pre-Filing
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Category", summary?.recentCase.category ?? "Tenancy Dispute"],
              ["Jurisdiction Forum", "Rent Controller / Small Causes"],
              ["Ledger Updated", "2 days ago"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3">
                <p className="text-[10px] font-sans uppercase tracking-[0.12em] text-[#85725f] font-semibold">{label}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#2a1c12]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-sans uppercase tracking-[0.08em] text-[#85725f] font-medium">Matter Progress</span>
              <span className="font-mono font-semibold text-[#9a6a35]">Stage 4 of 5</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[1px] bg-[#ebe1d1]">
              <div className="h-full w-[75%] bg-[#9a6a35]" />
            </div>
            <p className="text-xs text-[#5b4a3b] leading-relaxed pt-1">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#2e7d32] align-middle" />
              Notice response period completed. Advocate brief ready for formal petition filing.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e2d5c1]/60 flex flex-wrap gap-2.5">
            <Button size="sm" variant="primary" onClick={() => router.push(dh("/cases/case_2041/progress"))}>
              Inspect Matter Progress <ArrowUpRight className="size-3.5 ml-1" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(dh("/brief"))}>
              Review Case Brief
            </Button>
            <Button size="sm" variant="ghost" onClick={() => router.push(dh("/advocates"))}>
              Match Advocate
            </Button>
          </div>
        </section>

        {/* Next Statutory Deadlines */}
        <section className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 shadow-[0_1px_2px_rgba(42,28,18,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e2d5c1]/60">
              <h2 className="font-serif text-[19px] sm:text-[21px] font-normal text-[#2a1c12]">
                Court Deadlines
              </h2>
              <Link href={dh("/deadlines")} className="text-xs uppercase tracking-[0.08em] font-semibold text-[#9a6a35] hover:underline">
                Full Calendar
              </Link>
            </div>

            <ul className="mt-4 divide-y divide-[#e2d5c1]/60">
              {(summary?.deadlines ?? []).map((d) => {
                const days = daysUntil(d.date, today);
                const urgent = days <= 4;
                return (
                  <li key={d.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 items-start">
                    <div
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-[2px] border text-center font-mono",
                        urgent
                          ? "border-[#c0392b]/30 bg-[#fdf2f0] text-[#c0392b]"
                          : "border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#2a1c12]"
                      )}
                    >
                      <span className="text-[13px] leading-none font-bold">{new Date(d.date).getDate()}</span>
                      <span className="text-[8.5px] uppercase font-sans font-semibold">
                        {new Date(d.date).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#2a1c12] leading-snug">{d.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#85725f]">
                        {relativeDay(d.date, today)} · {d.basis}
                      </p>
                    </div>
                    {!d.confirmed && (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#b54708]" title="Statutory confirmation pending" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href={dh("/deadlines")}
            className="mt-5 flex items-center justify-between rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-3.5 py-2.5 text-xs font-semibold text-[#2a1c12] transition hover:bg-[#ebe1d1]/60"
          >
            <span>Verify Dates with Advocate</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {/* Quick Actions Grid */}
      <section>
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="font-serif text-[20px] sm:text-[22px] font-normal text-[#2a1c12]">
            Core Legal Services
          </h2>
          <span className="text-xs text-[#85725f]">Select a module to continue</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              href={dh(a.to)}
              className="group flex flex-col rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-4 transition-all duration-150 hover:border-[#9a6a35] hover:shadow-[0_4px_20px_rgba(42,28,18,0.06)]"
            >
              <span className="mb-3 grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35] group-hover:bg-[#2a1c12] group-hover:text-[#fffaf2] group-hover:border-[#2a1c12] transition-colors">
                <a.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-sans uppercase tracking-[0.06em] font-semibold text-[#2a1c12] leading-snug">
                {a.label}
              </span>
              <span className="mt-1 text-[11px] leading-4 text-[#85725f]">{a.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <Disclaimer
        text={`Advocate roll entries and statutory limitation summaries verified as of ${lastReviewed}. Preliminary assessments do not replace advocate consultation.`}
      />
    </div>
  );
}
