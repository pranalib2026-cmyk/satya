"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, FolderLock, Plus, Scale } from "lucide-react";
import { deadlines } from "@/data/dashboard-mock-data";
import { fetchCases } from "@/services/dashboard/cases";
import type { CaseProfile } from "@/types/dashboard";
import { dh, formatDate, relativeDay } from "@/lib/dashboard-utils";
import { useDashboardToday } from "@/lib/dashboard-time";
import { Badge, Button } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";

const statusTone = { active: "mint", draft: "warn", closed: "neutral" } as const;

export default function CasesPage() {
  const router = useRouter();
  const today = useDashboardToday();
  const [caseList, setCaseList] = useState<CaseProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then((data) => setCaseList(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        eyebrow="Matter Management"
        title="Active Case Files & Legal Proceedings"
        subtitle="Centralized docket tracking statutory chronology, limitation deadlines, filed pleadings, and advocate engagements."
        actions={
          <Button variant="compound" size="sm" onClick={() => router.push(dh("/intake"))}>
            <Plus className="size-3.5 mr-1" aria-hidden /> Enroll New Matter
          </Button>
        }
      />

      <div className="space-y-4">
        {loading && caseList.length === 0 ? (
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-8 text-center text-xs text-[#85725f]">
            Loading docket from backend...
          </div>
        ) : null}
        {caseList.map((c) => {
          const next = deadlines
            .filter((d) => d.caseId === c.id)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          return (
            <div
              key={c.id}
              className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 shadow-[0_1px_2px_rgba(42,28,18,0.04)] transition-all duration-200 hover:border-[#cfbe9e]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#e2d5c1]/60">
                <div className="flex items-start gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                    <FolderLock className="size-5" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-[19px] sm:text-[21px] font-normal text-[#2a1c12] leading-snug">
                        {c.title}
                      </h2>
                      <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-[#5b4a3b]">
                      {c.category} · {c.probableForum}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#85725f] pt-0.5">
                      <span>Updated {relativeDay(c.updatedAt, today)}</span>
                      <span className="capitalize">Urgency: {c.urgency.replace("-", " ")}</span>
                      <span className="font-mono">{c.keyDates.length} statutory dates</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link
                    href={dh(`/cases/${c.id}/progress`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[2px] border border-[#2a1c12] bg-[#2a1c12] px-4 text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#fffaf2] transition hover:bg-[#9a6a35] hover:border-[#9a6a35]"
                  >
                    Inspect Ledger <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                  <Link
                    href={dh("/brief")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 px-3.5 text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#2a1c12] transition hover:bg-[#ebe1d1]"
                  >
                    Matter Brief
                  </Link>
                </div>
              </div>

              {next && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-4 py-3">
                  <CalendarClock className="size-4 shrink-0 text-[#b54708]" aria-hidden />
                  <p className="flex-1 text-xs text-[#5b4a3b]">
                    <span className="font-semibold text-[#2a1c12]">Critical Upcoming Limitation: </span>
                    {next.title} · <strong className="font-mono">{formatDate(next.date, { day: "numeric", month: "short" })}</strong>
                  </p>
                  <Badge tone={next.urgency === "immediate" ? "danger" : next.urgency === "time-bound" ? "warn" : "brand"}>
                    {relativeDay(next.date, today)}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 sm:p-6 shadow-[0_1px_2px_rgba(42,28,18,0.04)] flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
            <Scale className="size-4.5" aria-hidden />
          </span>
          <div className="space-y-0.5">
            <p className="font-serif text-[17px] font-normal text-[#2a1c12]">Have you received a summons, notice, or order?</p>
            <p className="text-xs text-[#5b4a3b] leading-relaxed">
              Extract limitation periods, cited statutory provisions, and compliance obligations using OCR analysis.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={() => router.push(dh("/scan"))}>
            Scan Document
          </Button>
          <Button size="sm" variant="primary" onClick={() => router.push(dh("/intake"))}>
            Enter New Matter
          </Button>
        </div>
      </div>
    </div>
  );
}
