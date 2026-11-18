"use client";

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Landmark,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'
import { cases, caseStages, hearings, iso } from '@/data/dashboard-mock-data'
import { cn } from '@/lib/utils'
import { dh, formatDate, formatDateTime, relativeDay } from '@/lib/dashboard-utils'
import { useDashboardToday } from '@/lib/dashboard-time'
import { Badge, Button, Card, Input, Textarea } from '@/components/dashboard/ui'
import { Disclaimer, PageHeader } from '@/components/dashboard/shared'
import { useDashboardUI } from '@/lib/dashboard-ui-context'

const genericStages = [
  {
    id: 'g1',
    caseId: '',
    title: 'Case profile created',
    date: iso(-12),
    status: 'done' as const,
    plainExplanation: 'Your facts are organised into a profile. This is a record, not a court filing.',
    whatNext: 'Review the case brief and add missing documents.',
  },
  {
    id: 'g2',
    caseId: '',
    title: 'Notice stage',
    date: iso(-5),
    status: 'current' as const,
    plainExplanation: 'A written notice gives the other side a chance to settle before a complaint is filed.',
    whatNext: 'Confirm the notice date and keep proof of dispatch.',
  },
  {
    id: 'g3',
    caseId: '',
    title: 'Filing and hearing',
    status: 'upcoming' as const,
    plainExplanation: 'If there is no response, a complaint is filed and the court fixes a first hearing.',
    whatNext: 'Book an advocate review before filing.',
  },
]

export default function CaseProgressPage() {
  const today = useDashboardToday()
  const params = useParams()
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId ?? 'case_2041'
  const { pushNotification } = useDashboardUI()
  const c = cases.find((x) => x.id === caseId) ?? cases[0]
  const stages = caseStages.filter((s) => s.caseId === caseId)
  const timeline = stages.length > 0 ? stages : genericStages
  const caseHearings = hearings.filter((h) => h.caseId === caseId)

  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState(false)
  const [cnr, setCnr] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookup, setLookup] = useState<null | {
    status: string
    court: string
    nextHearing: string
    lastOrder: string
    judge: string
  }>(null)

  const ask = () => {
    if (!question.trim()) return
    setAsked(true)
    setQuestion('')
    pushNotification({
      title: 'Question sent to your advocate',
      body: 'Adv. Ananya Rao will reply in Messages. Urgent questions should be sent from Messages.',
      href: '/messages',
    })
  }

  const lookupCnr = async () => {
    if (cnr.trim().length < 6) return
    setLooking(true)
    setLookup(null)
    await new Promise((r) => setTimeout(r, 1200))
    setLookup({
      status: 'Pending — evidence',
      court: 'City Civil Court, Bengaluru (CCH-24)',
      nextHearing: formatDate(iso(21), { weekday: 'long', day: 'numeric', month: 'long' }),
      lastOrder: 'Both parties present. Reply to be filed. Matter adjourned.',
      judge: 'Hon’ble Judge, CCH-24',
    })
    setLooking(false)
  }

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow={`${c.category} · ${c.status}`}
        title={c.title}
        subtitle={`${c.probableForum} · ${c.summary}`}
        backTo={dh('/cases')}
        actions={
          <>
            <Link
              href={dh('/brief')}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand-soft px-4 text-[13px] font-semibold text-brand-dark hover:bg-secondary-bg"
            >
              <FileText className="size-4" aria-hidden /> Case brief
            </Link>
            <Link
              href={dh('/messages')}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-[13px] font-semibold text-card-bg hover:bg-brand-dark"
            >
              <MessageSquare className="size-4" aria-hidden /> Ask advocate
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Timeline */}
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold">Case timeline</h2>
              <Badge tone="outline">Plain-language stages</Badge>
            </div>

            <ol className="relative space-y-0">
              {timeline.map((s, i) => {
                const done = s.status === 'done'
                const current = s.status === 'current'
                return (
                  <li key={s.id} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {i < timeline.length - 1 && (
                      <span
                        className={cn('absolute top-6 left-[11px] h-full w-0.5', done ? 'bg-dot/40' : 'bg-line')}
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2',
                        done && 'border-dot bg-dot text-card-bg',
                        current && 'border-brand bg-card-bg text-brand ring-4 ring-brand/10',
                        s.status === 'upcoming' && 'border-line bg-card-bg text-muted',
                      )}
                    >
                      {done ? <Check className="size-3" aria-hidden /> : current ? <Circle className="size-2 fill-current" aria-hidden /> : <Circle className="size-2" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn('text-[13px] font-bold', !done && !current && 'text-body')}>{s.title}</h3>
                        {s.date && (
                          <span className="text-[10px] text-muted">
                            {formatDate(s.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {current && <Badge tone="brand">You are here</Badge>}
                      </div>
                      <p className="mt-1 text-[12px] leading-5.5 text-body">{s.plainExplanation}</p>
                      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-brand-dark">
                        <ArrowRight className="mt-1 size-3 shrink-0" aria-hidden /> {s.whatNext}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          {/* Hearings */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
                <CalendarDays className="size-4 text-brand" aria-hidden /> Hearing dates
              </h2>
              <span className="text-[10.5px] text-muted">Confirm with the cause list</span>
            </div>
            <div className="mt-3 space-y-2">
              {(caseHearings.length ? caseHearings : hearings.slice(0, 1)).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-center">
                    <span className="text-[13px] leading-none font-extrabold text-brand-dark">{new Date(h.date).getDate()}</span>
                    <span className="text-[8px] font-bold text-brand-dark uppercase">{new Date(h.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink">{h.purpose}</p>
                    <p className="text-[11px] text-body">{h.court}</p>
                    <p className="text-[10.5px] text-muted">{formatDateTime(h.date)} · {relativeDay(h.date, today)}</p>
                  </div>
                  <Badge tone={h.status === 'upcoming' ? 'brand' : 'neutral'}>{h.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Ask a question */}
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
              <HelpCircle className="size-4 text-brand" aria-hidden /> Ask a question about your case
            </h2>
            <p className="mt-1 text-[11.5px] text-body">
              Sent to Adv. Ananya Rao, who has your case brief. For urgent safety issues, use the Emergency page.
            </p>
            {asked ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint-soft px-3.5 py-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-dot" aria-hidden />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-dot">Question routed to your advocate</p>
                  <p className="text-[11px] text-body">You will get a reply in Messages. Typical reply time is within one day.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setAsked(false)}>Ask another</Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  placeholder="For example: should I file before the Rent Controller or send another notice?"
                  className="min-h-11 flex-1"
                />
                <Button onClick={ask} disabled={!question.trim()} className="sm:self-end">
                  <Send className="size-4" aria-hidden /> Send
                </Button>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          {/* CNR lookup */}
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
              <Landmark className="size-4 text-brand" aria-hidden /> eCourts lookup
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-body">
              Enter a CNR number to check case status. Results are shown where available.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Input
                value={cnr}
                onChange={(e) => setCnr(e.target.value.toUpperCase())}
                placeholder="e.g. KABB010012342026"
                className="h-10 text-[11px]"
                aria-label="CNR number"
              />
              <Button size="md" variant="secondary" onClick={lookupCnr} disabled={cnr.trim().length < 6 || looking}>
                {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[9.5px] text-muted">Mock response · eCourts integration is not live in this build.</p>

            {looking && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Loader2 className="size-3.5 animate-spin" /> Fetching status…</p>}

            {lookup && (
              <div className="mt-3 space-y-2 rounded-xl border border-line bg-brand-tint p-3 animate-in-up">
                <Badge tone="warn">{lookup.status}</Badge>
                <div>
                  <p className="text-[9.5px] font-semibold text-muted uppercase">Court</p>
                  <p className="text-[11.5px] font-medium text-ink">{lookup.court}</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-semibold text-muted uppercase">Next hearing</p>
                  <p className="text-[11.5px] font-medium text-ink">{lookup.nextHearing}</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-semibold text-muted uppercase">Last order</p>
                  <p className="text-[11.5px] leading-5 text-body">{lookup.lastOrder}</p>
                </div>
                <a
                  href="https://ecourts.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 pt-1 text-[10.5px] font-semibold text-brand hover:underline"
                >
                  Check on eCourts <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            )}
          </Card>

          {/* Case facts */}
          <Card className="p-5">
            <h2 className="text-[13.5px] font-bold">Case facts</h2>
            <dl className="mt-2.5 space-y-2 text-[11.5px]">
              {[
                ['Category', c.category],
                ['Sub-category', c.subCategory],
                ['Forum', c.probableForum],
                ['Urgency', c.urgency.replace('-', ' ')],
                ['Complexity', c.complexity.replaceAll('-', ' ')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-semibold capitalize text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-xl bg-brand-tint p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-ink">
                <Sparkles className="size-3 text-brand" aria-hidden /> Your goal
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-body">{c.userGoal}</p>
            </div>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-[11.5px] font-bold">
              <Clock className="size-3.5 text-warn" aria-hidden /> Next deadline
            </p>
            <p className="mt-1 text-[12px] text-body">
              {c.keyDates[0] ? `${relativeDay(c.keyDates[0].date, today)} — ${c.keyDates[0].label}` : 'No date recorded yet'}
            </p>
            <Link href={dh('/deadlines')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              Open deadline tracker <ArrowRight className="size-3" aria-hidden />
            </Link>
          </Card>

          <Disclaimer variant="banner" text="Stage explanations are general information. Your advocate should confirm what applies to your case." />
        </aside>
      </div>
    </div>
  )
}
