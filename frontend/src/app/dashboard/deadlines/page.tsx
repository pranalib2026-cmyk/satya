"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  Scale,
} from "lucide-react";
import { deadlineRules, listDeadlines, reminderOffsets } from "@/services/dashboard/deadlines";
import type { Deadline } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { dh, relativeDay } from "@/lib/dashboard-utils";
import { DASHBOARD_TODAY_PLACEHOLDER, useDashboardToday } from "@/lib/dashboard-time";
import { Badge, Button, Input, Modal, Tabs } from "@/components/dashboard/ui";
import { Disclaimer, PageHeader } from "@/components/dashboard/shared";

const urgencyStyles = {
  immediate: { chip: "danger" as const, bar: "bg-[#c0392b]", text: "text-[#c0392b]", label: "Immediate" },
  "time-bound": { chip: "warn" as const, bar: "bg-[#b54708]", text: "text-[#b54708]", label: "Time-Bound" },
  routine: { chip: "brand" as const, bar: "bg-[#9a6a35]", text: "text-[#9a6a35]", label: "Routine" },
};

export default function DeadlinesPage() {
  const today = useDashboardToday();
  const todayIso = today.toISOString().slice(0, 10);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => new Date(DASHBOARD_TODAY_PLACEHOLDER));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Deadline | null>(null);
  const [triggerDate, setTriggerDate] = useState("");
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    void listDeadlines().then(setDeadlines);
  }, []);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cells: Array<{ day: number; date: string } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) {
      const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, date });
    }
    return cells;
  }, [month]);

  const onDate = (date: string) => deadlines.filter((d) => d.date === date);

  const confirm = () => {
    if (!confirming) return;
    setDeadlines((all) =>
      all.map((d) =>
        d.id === confirming.id ? { ...d, confirmed: true, date: triggerDate || d.date } : d
      )
    );
    setConfirming(null);
  };

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        eyebrow="Court Calendars & Statutory Rules"
        title="Statutory Limitation & Filing Deadlines"
        subtitle="Calculated strictly according to limitation provisions in central and state procedural codes. AI is never permitted to guess statutory cutoff dates."
        actions={
          <div className="flex items-center gap-2">
            <Tabs
              size="sm"
              value={view}
              onChange={(v) => setView(v as "list" | "calendar")}
              options={[
                { value: "list", label: "Ledger View" },
                { value: "calendar", label: "Court Calendar" },
              ]}
            />
            <Button size="sm" variant="compound" onClick={() => setConfirming(deadlines[0])}>
              <Plus className="size-3.5 mr-1" aria-hidden /> Confirm Trigger Date
            </Button>
          </div>
        }
      />

      {/* Reminder Strip */}
      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-4 text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
        <p className="flex items-center gap-2 text-[#5b4a3b]">
          <BellRing className="size-4 text-[#9a6a35]" aria-hidden />
          Automated limitation alerts trigger at <strong className="text-[#2a1c12] font-mono">{reminderOffsets.join(", ")} days</strong> prior to formal filing expiration.
        </p>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="text-left font-semibold text-[#9a6a35] hover:underline cursor-pointer"
        >
          {showRules ? "Hide" : "Inspect"} Statutory Schedule Rules
        </button>
      </div>

      {showRules && (
        <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] overflow-hidden shadow-[0_1px_2px_rgba(42,28,18,0.04)] animate-in-up">
          <div className="border-b border-[#e2d5c1] bg-[#ebe1d1]/30 px-5 py-3.5">
            <p className="text-xs font-semibold text-[#2a1c12] uppercase tracking-[0.08em]">Statutory Limitation Schedule</p>
            <p className="text-[11px] text-[#85725f]">Reference table drawn from Limitation Act, 1963 and NI Act, 1881.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#e2d5c1] bg-[#ebe1d1]/40 text-[10.5px] font-sans uppercase tracking-[0.12em] text-[#85725f]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-5 py-2.5 font-medium">Triggering Event</th>
                  <th className="px-5 py-2.5 font-medium">Statutory Period</th>
                  <th className="px-5 py-2.5 font-medium">Enacting Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2d5c1] text-[#2a1c12]">
                {deadlineRules.map((r) => (
                  <tr key={r.id} className="hover:bg-[#ebe1d1]/20 transition-colors">
                    <td className="px-5 py-3 font-semibold">{r.category}</td>
                    <td className="px-5 py-3 text-[#5b4a3b]">{r.triggerEvent}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-[#9a6a35]">{r.periodDays} days</td>
                    <td className="px-5 py-3 text-[#5b4a3b]">{r.legalBasis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "list" ? (
        <div className="space-y-3">
          {deadlines.map((d) => {
            const style = urgencyStyles[d.urgency];
            return (
              <div
                key={d.id}
                className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 shadow-[0_1px_2px_rgba(42,28,18,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center justify-between hover:border-[#cfbe9e] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/40 text-center font-mono">
                    <p className="text-[17px] leading-none font-bold text-[#2a1c12]">{new Date(d.date).getDate()}</p>
                    <p className="text-[9px] font-sans uppercase tracking-[0.08em] font-semibold text-[#85725f]">
                      {new Date(d.date).toLocaleDateString("en-IN", { month: "short" })}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-serif text-[16px] sm:text-[18px] font-normal text-[#2a1c12]">{d.title}</p>
                      <Badge tone={style.chip}>{style.label}</Badge>
                      {d.confirmed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-sans uppercase tracking-[0.1em] font-semibold text-[#2e7d32]">
                          <Check className="size-3" aria-hidden /> Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-sans uppercase tracking-[0.1em] font-semibold text-[#b54708]">
                          <AlertTriangle className="size-3" aria-hidden /> Trigger Date Unconfirmed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5b4a3b]">
                      Matter: <span className="font-semibold text-[#2a1c12]">{d.caseTitle}</span> · Due in {relativeDay(d.date, today)}
                    </p>
                    <p className="text-[11.5px] text-[#85725f] flex items-center gap-1.5 pt-0.5">
                      <Info className="size-3 text-[#9a6a35]" aria-hidden /> Statutory Basis: {d.basis}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e2d5c1]/60">
                  <Button
                    size="sm"
                    variant={d.confirmed ? "ghost" : "secondary"}
                    onClick={() => {
                      setConfirming(d);
                      setTriggerDate(d.date);
                    }}
                  >
                    {d.confirmed ? "Adjust Trigger Date" : "Confirm Trigger Date"}
                  </Button>
                  <Link
                    href={dh("/advocates")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[2px] border border-[#2a1c12] bg-[#fffaf2] px-3.5 text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#2a1c12] hover:bg-[#2a1c12] hover:text-[#fffaf2] transition-colors"
                  >
                    <Scale className="size-3.5" aria-hidden /> Counsel Review
                  </Link>
                </div>
              </div>
            );
          })}

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-4 text-xs flex items-start gap-3 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
            <Scale className="mt-0.5 size-4 shrink-0 text-[#9a6a35]" aria-hidden />
            <p className="text-[#5b4a3b] leading-relaxed">
              <strong className="text-[#2a1c12]">Verify Limitation Period: </strong>
              Statutory computation depends on exact service dates of notice or order receipt. An advocate review before limitation expiry preserves your legal right to file.
            </p>
            <Link
              href={dh("/advocates")}
              className="ml-auto hidden shrink-0 items-center gap-1 text-xs font-semibold text-[#9a6a35] hover:underline sm:flex"
            >
              Consult Counsel <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] overflow-hidden shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
          <div className="flex items-center justify-between border-b border-[#e2d5c1] bg-[#ebe1d1]/30 px-5 py-3.5">
            <h2 className="font-serif text-[18px] sm:text-[20px] font-normal text-[#2a1c12]">
              {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:bg-[#ebe1d1]/50 transition cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:bg-[#ebe1d1]/50 transition cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[#e2d5c1] bg-[#ebe1d1]/40 text-center text-[10.5px] font-sans uppercase tracking-[0.14em] font-semibold text-[#85725f]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[#e2d5c1]/60">
            {days.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="min-h-[80px] bg-[#f4efe6]/20" />;
              const items = onDate(cell.date);
              const isToday = cell.date === todayIso;
              return (
                <button
                  type="button"
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    "min-h-[80px] p-2.5 text-left transition-colors cursor-pointer flex flex-col justify-between",
                    isToday ? "bg-[#ebe1d1]/40" : "hover:bg-[#ebe1d1]/20",
                    selectedDate === cell.date && "ring-1 ring-[#9a6a35] bg-[#ebe1d1]/40"
                  )}
                >
                  <span className={cn("font-mono text-xs font-semibold", isToday ? "text-[#9a6a35]" : "text-[#2a1c12]")}>
                    {cell.day}
                  </span>
                  {items.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {items.map((it) => (
                        <span
                          key={it.id}
                          className="block truncate rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-1.5 py-0.5 text-[10px] text-[#2a1c12]"
                          title={it.title}
                        >
                          {it.title}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Confirm Event Trigger Date"
        description="Statutory limitation is calculated strictly by adding statutory periods to your verified trigger date."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirm}>
              Save Confirmed Date
            </Button>
          </div>
        }
      >
        {confirming && (
          <div className="space-y-4 text-xs text-[#5b4a3b]">
            <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3.5 space-y-1">
              <p className="font-semibold text-[#2a1c12] text-sm">{confirming.title}</p>
              <p>Matter: {confirming.caseTitle}</p>
              <p className="text-[11px] text-[#85725f]">Statutory Basis: {confirming.basis}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">
                Verified Event Date (e.g. date notice served or cheque bounced)
              </label>
              <Input
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <p className="text-[11px] text-[#85725f] leading-relaxed">
              Upon confirmation, SMS and portal reminders will be automatically scheduled {reminderOffsets.join(", ")} days ahead.
            </p>
          </div>
        )}
      </Modal>

      <Disclaimer />
    </div>
  );
}
