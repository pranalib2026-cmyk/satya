"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Plus,
  Scale,
} from 'lucide-react'
import { deadlineRules, listDeadlines, reminderOffsets } from '@/services/dashboard/deadlines'
import type { Deadline } from '@/types/dashboard'
import { cn } from '@/lib/utils'
import { dh, formatDate, relativeDay } from '@/lib/dashboard-utils'
import { DASHBOARD_TODAY_PLACEHOLDER, useDashboardToday } from '@/lib/dashboard-time'
import { Badge, Button, Card, Input, Modal, Tabs } from '@/components/dashboard/ui'
import { Disclaimer, PageHeader } from '@/components/dashboard/shared'

const urgencyStyles = {
  immediate: { chip: 'danger' as const, bar: 'bg-danger', text: 'text-danger', label: 'Urgent' },
  'time-bound': { chip: 'warn' as const, bar: 'bg-warn', text: 'text-warn', label: 'Time-bound' },
  routine: { chip: 'brand' as const, bar: 'bg-brand', text: 'text-brand', label: 'Routine' },
}

export default function DeadlinesPage() {
  const today = useDashboardToday()
  const todayIso = today.toISOString().slice(0, 10)
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(() => new Date(DASHBOARD_TODAY_PLACEHOLDER))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<Deadline | null>(null)
  const [triggerDate, setTriggerDate] = useState('')
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    void listDeadlines().then(setDeadlines)
  }, [])

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const lead = first.getDay()
    const cells: Array<{ day: number; date: string } | null> = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= total; d++) {
      const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, date })
    }
    return cells
  }, [month])

  const onDate = (date: string) => deadlines.filter((d) => d.date === date)

  const confirm = () => {
    if (!confirming) return
    setDeadlines((all) =>
      all.map((d) =>
        d.id === confirming.id ? { ...d, confirmed: true, date: triggerDate || d.date } : d,
      ),
    )
    setConfirming(null)
  }

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Deadline tracker"
        title="Never miss a legal date"
        subtitle="Dates are computed from fixed rules, never by an AI. The trigger date is yours to confirm."
        actions={
          <div className="flex items-center gap-2">
            <Tabs
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />
            <Button size="sm" onClick={() => setConfirming(deadlines[0])}>
              <Plus className="size-3.5" aria-hidden /> Confirm a date
            </Button>
          </div>
        }
      />

      {/* Reminder strip */}
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-line bg-brand-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[12px] text-body">
          <BellRing className="size-4 text-brand" aria-hidden />
          Reminders are scheduled {reminderOffsets.join(', ')} days before each confirmed date.
          <span className="text-muted">(mock SMS)</span>
        </p>
        <button type="button" onClick={() => setShowRules((v) => !v)} className="text-left text-[11.5px] font-semibold text-brand hover:underline">
          {showRules ? 'Hide' : 'View'} deadline rules
        </button>
      </div>

      {showRules && (
        <Card className="mb-4 overflow-hidden animate-in-up">
          <div className="border-b border-line bg-brand-tint px-4 py-3">
            <p className="text-[12.5px] font-bold">Deadline rules (seeded from deadline_rules)</p>
            <p className="text-[10.5px] text-muted">Period is added to the trigger date in code. Verify against the current Act.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-4 py-2 font-semibold">Trigger event</th>
                  <th className="px-4 py-2 font-semibold">Period</th>
                  <th className="px-4 py-2 font-semibold">Legal basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deadlineRules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.category}</td>
                    <td className="px-4 py-2.5 text-body">{r.triggerEvent}</td>
                    <td className="px-4 py-2.5 font-semibold text-brand-dark">{r.periodDays} days</td>
                    <td className="px-4 py-2.5 text-body">{r.legalBasis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'list' ? (
        <div className="space-y-2.5">
          {deadlines.map((d) => {
            const style = urgencyStyles[d.urgency]
            return (
              <div key={d.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 sm:w-[86px] sm:flex-col sm:items-center sm:gap-0.5">
                  <p className="text-[22px] leading-none font-extrabold">{new Date(d.date).getDate()}</p>
                  <p className="text-[10.5px] font-bold tracking-wide text-muted uppercase">
                    {new Date(d.date).toLocaleDateString('en-IN', { month: 'short' })}
                  </p>
                </div>
                <div className={cn('hidden h-10 w-1 shrink-0 rounded-full sm:block', style.bar)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-bold text-ink">{d.title}</p>
                    <Badge tone={style.chip}>{style.label}</Badge>
                    {d.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-dot">
                        <Check className="size-3" aria-hidden /> Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-warn">
                        <AlertTriangle className="size-3" aria-hidden /> Needs confirmation
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-body">
                    {d.caseTitle} · {relativeDay(d.date, today)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted">
                    <Info className="size-3" aria-hidden /> {d.basis}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant={d.confirmed ? 'ghost' : 'secondary'}
                    onClick={() => { setConfirming(d); setTriggerDate(d.date) }}
                  >
                    {d.confirmed ? 'Edit date' : 'Confirm date'}
                  </Button>
                  <Link
                    href={dh('/advocates')}
                    className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold text-brand hover:bg-brand-soft"
                  >
                    <Scale className="size-3.5" aria-hidden /> Review
                  </Link>
                </div>
              </div>
            )
          })}

          <div className="flex items-start gap-2 rounded-xl bg-brand-tint px-3.5 py-3">
            <Scale className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <p className="text-[11.5px] leading-5 text-body">
              <span className="font-semibold text-ink">Confirm with an advocate. </span>
              Limitation periods can change with the facts. A short review before a filing date is always safer than guessing.
            </p>
            <Link href={dh('/advocates')} className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-brand hover:underline sm:flex">
              Find one <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[14px] font-bold">
              {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="grid size-8 place-items-center rounded-lg border border-line text-body hover:bg-brand-tint"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="grid size-8 place-items-center rounded-lg border border-line text-body hover:bg-brand-tint"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-line bg-brand-tint text-center text-[10px] font-bold tracking-wide text-muted uppercase">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-line/60 bg-card-bg" />
              const items = onDate(cell.date)
              const isToday = cell.date === todayIso
              return (
                <button
                  type="button"
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    'min-h-[72px] border-b border-r border-line/60 p-1.5 text-left transition hover:bg-brand-tint/50',
                    isToday && 'bg-brand-soft/50',
                  )}
                >
                  <span className={cn('inline-grid size-5 place-items-center rounded-full text-[10.5px] font-semibold', isToday ? 'bg-brand text-card-bg' : 'text-body')}>
                    {cell.day}
                  </span>
                  <span className="mt-1 flex flex-col gap-0.5">
                    {items.slice(0, 2).map((d) => (
                      <span key={d.id} className={cn('truncate rounded px-1 py-0.5 text-[8.5px] font-semibold text-card-bg', urgencyStyles[d.urgency].bar)}>
                        {d.title}
                      </span>
                    ))}
                    {items.length > 2 && <span className="text-[8px] text-muted">+{items.length - 2} more</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[10.5px] text-body">
            {Object.entries(urgencyStyles).map(([key, s]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', s.bar)} aria-hidden /> {s.label}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1 text-muted">
              <CalendarDays className="size-3.5" aria-hidden /> Click a date to see its deadlines
            </span>
          </div>
        </Card>
      )}

      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        description="Deadlines on this date"
      >
        <div className="space-y-2">
          {selectedDate && onDate(selectedDate).length === 0 && (
            <p className="rounded-xl bg-brand-tint px-3 py-6 text-center text-[12px] text-body">No deadlines on this date.</p>
          )}
          {selectedDate && onDate(selectedDate).map((d) => (
            <div key={d.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <Badge tone={urgencyStyles[d.urgency].chip}>{urgencyStyles[d.urgency].label}</Badge>
                {d.confirmed ? <span className="text-[10px] font-semibold text-dot">Confirmed</span> : <span className="text-[10px] font-semibold text-warn">Needs confirmation</span>}
              </div>
              <p className="mt-1.5 text-[12.5px] font-semibold text-ink">{d.title}</p>
              <p className="text-[11px] text-body">{d.caseTitle}</p>
              <p className="mt-0.5 text-[10.5px] text-muted">{d.basis}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* Confirm trigger date */}
      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirm the trigger date"
        description="The period is added to this date in code. Change it if the event happened on a different day."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button onClick={confirm}>
              <Check className="size-4" aria-hidden /> Confirm date
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-brand-tint p-3.5">
            <p className="text-[12.5px] font-bold text-ink">{confirming?.title}</p>
            <p className="mt-0.5 text-[11px] text-body">{confirming?.caseTitle}</p>
          </div>
          <div>
            <label className="label" htmlFor="trigger">Trigger date</label>
            <Input id="trigger" type="date" value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} />
            <p className="mt-1.5 text-[11px] text-muted">
              Basis: {confirming?.basis}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-warn-soft p-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <p className="text-[11px] leading-5 text-warn">
              Reminders will be scheduled 7, 3, 1 and 0 days before the confirmed date. Confirm the trigger date with an advocate if you are unsure.
            </p>
          </div>
        </div>
      </Modal>

      <div className="mt-4">
        <Disclaimer text="Dates are estimates computed from seeded rules. They are not legal advice and may change with the facts." />
      </div>
    </div>
  )
}
