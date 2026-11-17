"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, FolderLock, Plus, Scale } from "lucide-react";
import { cases, deadlines } from "@/data/dashboard-mock-data";
import { dh, formatDate, relativeDay } from "@/lib/dashboard-utils";
import { useDashboardToday } from "@/lib/dashboard-time";
import { Badge, Button, Card } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";

const statusTone = { active: 'mint', draft: 'warn', closed: 'neutral' } as const

export default function CasesPage() {
  const router = useRouter()
  const today = useDashboardToday()
  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="My cases"
        title="Your case files"
        subtitle="Every case keeps its facts, documents, deadlines and progress in one place."
        actions={
          <Button onClick={() => router.push(dh('/intake'))}>
            <Plus className="size-4" aria-hidden /> Start a new case
          </Button>
        }
      />

      <div className="space-y-3">
        {cases.map((c) => {
          const next = deadlines
            .filter((d) => d.caseId === c.id)
            .sort((a, b) => a.date.localeCompare(b.date))[0]
          return (
            <Card key={c.id} className="p-4 transition hover:border-brand/25 hover:shadow-pop sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <FolderLock className="size-5" aria-hidden />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-bold">{c.title}</h2>
                      <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-body">
                      {c.category} · {c.probableForum}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted">
                      <span>Updated {relativeDay(c.updatedAt, today)}</span>
                      <span className="capitalize">Urgency: {c.urgency.replace('-', ' ')}</span>
                      <span>{c.keyDates.length} key dates</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={dh(`/cases/${c.id}/progress`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12px] font-semibold text-card-bg transition hover:bg-brand-dark"
                  >
                    View progress <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                  <Link
                    href={dh('/brief')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-soft px-3.5 text-[12px] font-semibold text-brand-dark transition hover:bg-secondary-bg"
                  >
                    Case brief
                  </Link>
                </div>
              </div>

              {next && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-tint px-3.5 py-2.5">
                  <CalendarClock className="size-4 shrink-0 text-warn" aria-hidden />
                  <p className="flex-1 text-[11.5px] text-body">
                    <span className="font-semibold text-ink">Next: </span>
                    {next.title} · {formatDate(next.date, { day: 'numeric', month: 'short' })}
                  </p>
                  <Badge tone={next.urgency === 'immediate' ? 'danger' : next.urgency === 'time-bound' ? 'warn' : 'brand'}>
                    {relativeDay(next.date, today)}
                  </Badge>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl bg-brand-tint p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <Scale className="mt-0.5 size-4.5 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="text-[12.5px] font-bold">Do you have a notice or court paper?</p>
            <p className="mt-0.5 text-[11.5px] text-body">Scan it to understand the dates, amounts and what you must do next.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => router.push(dh('/scan'))}>Scan a document</Button>
          <Button size="sm" onClick={() => router.push(dh('/chat'))}>Ask the assistant</Button>
        </div>
      </div>
    </div>
  )
}
