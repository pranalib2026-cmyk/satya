"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { cases, caseStages, hearings, iso } from '@/data/dashboard-mock-data';
import { cn } from '@/lib/utils';
import { dh, formatDate, formatDateTime, relativeDay } from '@/lib/dashboard-utils';
import { useDashboardToday } from '@/lib/dashboard-time';
import { Badge, Button, Card, Input, Textarea } from '@/components/dashboard/ui';
import { Disclaimer, PageHeader } from '@/components/dashboard/shared';
import { useDashboardUI } from '@/lib/dashboard-ui-context';

const genericStages = [
  {
    id: 'g1',
    caseId: '',
    title: 'Case Dossier Compiled',
    date: iso(-12),
    status: 'done' as const,
    plainExplanation: 'Your verified factual narrative has been organized into a structured brief. This represents a client record, not a formal court submission.',
    whatNext: 'Inspect matter brief and verify documentation completeness.',
  },
  {
    id: 'g2',
    caseId: '',
    title: 'Statutory Notice Stage',
    date: iso(-5),
    status: 'current' as const,
    plainExplanation: 'A formal advocate notice affords the adverse party an opportunity to remediate before formal complaint initiation.',
    whatNext: 'Confirm postal dispatch acknowledgment and preserve registration receipts.',
  },
  {
    id: 'g3',
    caseId: '',
    title: 'Chamber Review & Filing',
    status: 'upcoming' as const,
    plainExplanation: 'In absence of settlement, the complaint is submitted to the jurisdictional bench and a preliminary hearing docket is assigned.',
    whatNext: 'Conclude advocate consultation prior to verified filing.',
  },
];

export default function CaseProgressPage() {
  const today = useDashboardToday();
  const params = useParams();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId ?? 'case_2041';
  const { pushNotification } = useDashboardUI();
  const c = cases.find((x) => x.id === caseId) ?? cases[0];
  const stages = caseStages.filter((s) => s.caseId === caseId);
  const timeline = stages.length > 0 ? stages : genericStages;
  const caseHearings = hearings.filter((h) => h.caseId === caseId);

  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false);
  const [cnr, setCnr] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookup, setLookup] = useState<null | {
    status: string;
    court: string;
    nextHearing: string;
    lastOrder: string;
    judge: string;
  }>(null);

  const ask = () => {
    if (!question.trim()) return;
    setAsked(true);
    setQuestion('');
    pushNotification({
      title: 'Inquiry transmitted to assigned advocate',
      body: 'Adv. Ananya Rao will respond in your secure messages channel.',
      href: '/messages',
    });
  };

  const lookupCnr = async () => {
    if (cnr.trim().length < 6) return;
    setLooking(true);
    setLookup(null);
    await new Promise((r) => setTimeout(r, 1200));
    setLookup({
      status: 'Pending — Evidence Presentation',
      court: 'City Civil Court, Bengaluru (CCH-24)',
      nextHearing: formatDate(iso(21), { weekday: 'long', day: 'numeric', month: 'long' }),
      lastOrder: 'Both parties present. Rejoinder directed. Matter adjourned.',
      judge: 'Presiding Judge, CCH-24',
    });
    setLooking(false);
  };

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow={`${c.category} · ${c.status}`}
        title={c.title}
        subtitle={`${c.probableForum} · ${c.summary}`}
        backTo={dh('/cases')}
        actions={
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={dh('/brief')}
              className="inline-flex h-10 items-center gap-1.5 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-4 font-mono text-[11px] uppercase tracking-wider text-[#2a1c12] hover:border-[#9a6a35] hover:bg-[#ebe1d1]/20 transition-colors"
            >
              <FileText className="size-3.5 text-[#9a6a35]" aria-hidden /> Matter Dossier
            </Link>
            <Link
              href={dh('/messages')}
              className="inline-flex h-10 items-center gap-1.5 rounded-[2px] bg-[#2a1c12] px-4 font-mono text-[11px] uppercase tracking-wider text-[#fffaf2] hover:bg-[#3d2b1f] transition-colors"
            >
              <MessageSquare className="size-3.5" aria-hidden /> Consult Advocate
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Timeline */}
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-[#e2d5c1] pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Statutory Sequence</p>
                <h2 className="mt-1 font-serif text-[18px] font-normal text-[#2a1c12]">Proceedings & Milestones</h2>
              </div>
              <Badge tone="neutral">Procedural Progression</Badge>
            </div>

            <ol className="relative space-y-0">
              {timeline.map((s, i) => {
                const done = s.status === 'done';
                const current = s.status === 'current';
                return (
                  <li key={s.id} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < timeline.length - 1 && (
                      <span
                        className={cn('absolute top-7 left-[11px] h-full w-[1px]', done ? 'bg-[#2a6b3b]' : 'bg-[#e2d5c1]')}
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-[2px] border font-mono text-[10px]',
                        done && 'border-[#2a6b3b] bg-[#2a6b3b] text-[#fffaf2]',
                        current && 'border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2] ring-2 ring-[#9a6a35]/20',
                        s.status === 'upcoming' && 'border-[#e2d5c1] bg-[#fffaf2] text-[#85725f]',
                      )}
                    >
                      {done ? <Check className="size-3" aria-hidden /> : current ? <Circle className="size-2 fill-current" aria-hidden /> : <Circle className="size-2" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className={cn('font-serif text-[16px] font-normal', done || current ? 'text-[#2a1c12]' : 'text-[#85725f]')}>{s.title}</h3>
                        {s.date && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#85725f]">
                            {formatDate(s.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {current && <Badge tone="brand">Active Docket</Badge>}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#5b4a3b]">{s.plainExplanation}</p>
                      <p className="mt-2 flex items-start gap-1.5 font-mono text-[11px] uppercase tracking-wide text-[#9a6a35]">
                        <ArrowRight className="mt-0.5 size-3 shrink-0" aria-hidden /> {s.whatNext}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Hearings */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Cause List Tracker</p>
                <h2 className="mt-1 flex items-center gap-2 font-serif text-[18px] font-normal text-[#2a1c12]">
                  <CalendarDays className="size-4 text-[#9a6a35]" aria-hidden /> Judicial Cause List Dates
                </h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#85725f]">Verify via Registry</span>
            </div>
            <div className="mt-4 space-y-3">
              {(caseHearings.length ? caseHearings : hearings.slice(0, 1)).map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-4 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-center">
                    <span className="font-serif text-[16px] leading-none font-normal text-[#2a1c12]">{new Date(h.date).getDate()}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#85725f]">{new Date(h.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[14px] font-normal text-[#2a1c12]">{h.purpose}</p>
                    <p className="text-[12px] text-[#5b4a3b]">{h.court}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-[#85725f]">{formatDateTime(h.date)} · {relativeDay(h.date, today)}</p>
                  </div>
                  <Badge tone={h.status === 'upcoming' ? 'brand' : 'neutral'}>{h.status.toUpperCase()}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Ask a question */}
          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Chamber Dispatch</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-[18px] font-normal text-[#2a1c12]">
              <HelpCircle className="size-4 text-[#9a6a35]" aria-hidden /> Direct Inquiry to Retained Advocate
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#5b4a3b]">
              Forwarded directly to Adv. Ananya Rao. Confidential matter communications are protected under client-advocate privilege.
            </p>
            {asked ? (
              <div className="mt-4 flex items-start gap-3 rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 p-4">
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-[#2a6b3b]" aria-hidden />
                <div className="flex-1">
                  <p className="text-[12.5px] font-medium text-[#2a6b3b]">Inquiry dispatched to counsel docket</p>
                  <p className="text-[11.5px] text-[#5b4a3b]">Counsel review typically completes within one court working day.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setAsked(false)}>New Note</Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  placeholder="Specify question regarding next filing date, rejoinder requirements, or forum jurisdiction…"
                  className="min-h-12 flex-1"
                />
                <Button onClick={ask} disabled={!question.trim()} className="sm:self-end">
                  <Send className="size-4" aria-hidden /> Transmit
                </Button>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {/* CNR lookup */}
          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">CIS Registry Interrogation</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
              <Landmark className="size-4 text-[#9a6a35]" aria-hidden /> eCourts CNR Lookup
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5b4a3b]">
              Enter a 16-character Case Number Record (CNR) to poll live CIS order sheets.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={cnr}
                onChange={(e) => setCnr(e.target.value.toUpperCase())}
                placeholder="e.g. KABB010012342026"
                className="h-10 font-mono text-[11px]"
                aria-label="CNR number"
              />
              <Button size="md" variant="secondary" onClick={lookupCnr} disabled={cnr.trim().length < 6 || looking}>
                {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-[#85725f]">Sandbox gateway · CIS live polling simulation.</p>

            {looking && <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-[#85725f]"><Loader2 className="size-3.5 animate-spin text-[#9a6a35]" /> Interrogating National Judicial Data Grid…</p>}

            {lookup && (
              <div className="mt-4 space-y-2.5 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4">
                <Badge tone="warn">{lookup.status}</Badge>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#85725f]">Court Bench</p>
                  <p className="font-serif text-[13px] text-[#2a1c12]">{lookup.court}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#85725f]">Next Listing</p>
                  <p className="font-serif text-[13px] text-[#2a1c12]">{lookup.nextHearing}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#85725f]">Last Interlocutory Order</p>
                  <p className="text-[12px] leading-relaxed text-[#5b4a3b]">{lookup.lastOrder}</p>
                </div>
                <a
                  href="https://ecourts.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-[#9a6a35] hover:underline"
                >
                  Verify on ecourts.gov.in <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            )}
          </Card>

          {/* Case facts */}
          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Dossier Registry</p>
            <h2 className="mt-1 font-serif text-[16px] font-normal text-[#2a1c12]">Verified Matter Facts</h2>
            <dl className="mt-3 space-y-2 text-[12px]">
              {[
                ['Category', c.category],
                ['Sub-category', c.subCategory],
                ['Jurisdiction Forum', c.probableForum],
                ['Urgency Class', c.urgency.replace('-', ' ')],
                ['Complexity Index', c.complexity.replaceAll('-', ' ')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[#e2d5c1] pb-2">
                  <dt className="text-[#85725f]">{k}</dt>
                  <dd className="text-right font-medium capitalize text-[#2a1c12]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3.5">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#2a1c12]">
                <Sparkles className="size-3 text-[#9a6a35]" aria-hidden /> Client Objective
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#5b4a3b]">{c.userGoal}</p>
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#b97a29]">
              <Clock className="size-3.5" aria-hidden /> Next Limitation Trigger
            </p>
            <p className="mt-1 font-serif text-[14px] text-[#2a1c12]">
              {c.keyDates[0] ? `${relativeDay(c.keyDates[0].date, today)} — ${c.keyDates[0].label}` : 'No date recorded yet'}
            </p>
            <Link href={dh('/deadlines')} className="mt-2.5 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-[#9a6a35] hover:underline">
              Inspect limitation ledger <ArrowRight className="size-3" aria-hidden />
            </Link>
          </Card>

          <Disclaimer variant="banner" text="Procedural stage outlines reflect standardized statutory pathways. Consult your appointed advocate for case-specific motions." />
        </aside>
      </div>
    </div>
  );
}
