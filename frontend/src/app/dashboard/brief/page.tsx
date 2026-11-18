"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Pencil,
  Scale,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { advocates, cases, documents } from "@/data/dashboard-mock-data";
import { loadCaseProfile } from "@/services/dashboard/intake";
import { saveConsent } from "@/services/dashboard/consent";
import { Button, Card, Badge, Checkbox, Textarea } from "@/components/dashboard/ui";
import { PageHeader, Disclaimer } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, dh } from "@/lib/dashboard-utils";

export default function BriefPage() {
  const profile = loadCaseProfile() ?? cases[0]
  const [editing, setEditing] = useState(false)
  const [sections, setSections] = useState({
    facts:
      profile.summary ||
      'The tenant vacated the flat on 15 September 2026 after the lease ended. A security deposit of ₹60,000 was paid in March 2024. The landlord has not refunded it and alleges paint damage without an inspection report.',
    timeline:
      '12 Mar 2024 — lease signed and deposit paid\n15 Sep 2026 — premises vacated, keys returned\n15 Oct 2026 — written reminder sent\n2 Oct 2026 — legal notice received from landlord’s advocate',
    parties: 'Rahul Kumar — tenant (client)\nMr. S. Rao — landlord (opposite party)\nM/s Rao & Associates — advocates for the landlord',
    documents: 'Rent agreement (12 pages)\nDeposit transfer receipt\nHandover photographs\nWritten reminder and reply',
    sections:
      'Transfer of Property Act, 1882 — s.108 (return of deposit)\nKarnataka Rent Act, 1999 — s.27 (Rent Controller)\nLimitation Act, 1963 — three years for money claims',
    forum: profile.probableForum || 'Rent Controller, Bengaluru Urban',
    limitation: 'Claim should be filed within three years of the deposit becoming due. Internal target: 15 Nov 2026.',
    goal: profile.userGoal || 'Recover the ₹60,000 deposit without a prolonged court process.',
  })
  const [attached, setAttached] = useState<string[]>(['doc_1', 'doc_2'])
  const [advocateId, setAdvocateId] = useState(advocates[0].id)
  const [consent, setConsent] = useState(false)
  const [shared, setShared] = useState(false)
  const [sharedAt, setSharedAt] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const advocate = advocates.find((a) => a.id === advocateId) ?? advocates[0]

  const share = async () => {
    setSharing(true)
    await saveConsent({
      userId: 'usr_1024',
      consentType: 'share_brief',
      version: '1.0',
      purpose: 'Case brief review and consultation',
      advocateId,
      itemsShared: ['Case brief', ...documents.filter((d) => attached.includes(d.id)).map((d) => d.name)],
    })
    setSharing(false)
    setSharedAt(new Date().toISOString())
    setShared(true)
  }

  const sectionFields: Array<{ key: keyof typeof sections; label: string; rows: number }> = [
    { key: 'facts', label: 'Summary of facts', rows: 5 },
    { key: 'timeline', label: 'Timeline', rows: 5 },
    { key: 'parties', label: 'Parties', rows: 3 },
    { key: 'documents', label: 'Documents held', rows: 4 },
    { key: 'sections', label: 'Relevant sections', rows: 4 },
    { key: 'forum', label: 'Probable forum', rows: 2 },
    { key: 'limitation', label: 'Limitation deadline', rows: 2 },
    { key: 'goal', label: 'Your goal', rows: 2 },
  ]

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Consent & handoff"
        title="Your case brief"
        subtitle="An auto-generated summary you control. Edit anything, choose which documents to attach, and share only with your explicit consent."
        backTo={dh('/advocates')}
        actions={
          <Badge tone="brand"><Sparkles className="size-3" /> Generated from your case profile</Badge>
        }
      />

      {shared ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dot/30 bg-mint-soft p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card-bg text-dot">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-dot">Brief shared with Adv. {advocate.name}</h2>
                <p className="mt-1 text-[12px] leading-5 text-body">
                  A read-only snapshot was created on {sharedAt ? formatDate(sharedAt) : 'today'}. The consent record includes the advocate,
                  purpose, items shared and a revocable flag.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="mint">Consent recorded</Badge>
                  <Badge tone="neutral">Snapshot v1</Badge>
                  <Badge tone="neutral">{attached.length} document(s) attached</Badge>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-brand-tint px-5 py-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                <Lock className="size-3.5 text-muted" aria-hidden /> Read-only snapshot
              </p>
              <span className="text-[10.5px] text-muted">Shared {sharedAt ? formatDateTime(sharedAt) : '—'}</span>
            </div>
            <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              {sectionFields.map((f) => (
                <div key={f.key} className={f.key === 'facts' || f.key === 'timeline' ? 'sm:col-span-2' : ''}>
                  <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">{f.label}</p>
                  <p className="mt-1 text-[12.5px] leading-5.5 whitespace-pre-line text-ink">{sections[f.key]}</p>
                </div>
              ))}
              <div className="sm:col-span-2">
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Documents attached</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {documents.filter((d) => attached.includes(d.id)).map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1 rounded-full bg-secondary-bg px-2.5 py-1 text-[10.5px] font-semibold text-body">
                      <FileText className="size-3" aria-hidden /> {d.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setShared(false)}>
              <Pencil className="size-4" aria-hidden /> Make changes
            </Button>
            <div className="flex gap-2">
              <Link
                href={dh("/profile")}
                className="inline-flex h-11 items-center rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand-dark transition hover:bg-secondary-bg"
              >
                Manage consent
              </Link>
              <Link
                href={dh("/booking/adv_1")}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-card-bg transition hover:bg-brand-dark"
              >
                Book consultation <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <Disclaimer />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-tint px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Draft brief · {profile.category}</p>
                <h2 className="mt-0.5 text-[15px] font-bold">{profile.title}</h2>
              </div>
              <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)}>
                {editing ? <><Check className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit</>}
              </Button>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              {sectionFields.map((f) => (
                <div key={f.key} className={f.key === 'facts' || f.key === 'timeline' ? 'sm:col-span-2' : ''}>
                  <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">{f.label}</p>
                  {editing ? (
                    f.rows > 3 ? (
                      <Textarea
                        rows={f.rows}
                        value={sections[f.key]}
                        onChange={(e) => setSections({ ...sections, [f.key]: e.target.value })}
                      />
                    ) : (
                      <Textarea
                        rows={3}
                        value={sections[f.key]}
                        onChange={(e) => setSections({ ...sections, [f.key]: e.target.value })}
                      />
                    )
                  ) : (
                    <p className="rounded-lg bg-brand-tint px-3 py-2.5 text-[12.5px] leading-5.5 whitespace-pre-line text-ink">
                      {sections[f.key]}
                    </p>
                  )}
                </div>
              ))}

              <div className="sm:col-span-2">
                <div className="flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                  <p className="text-[11.5px] leading-5 text-warn">
                    <span className="font-bold">Limitation note: </span>
                    dates are computed in code, not by AI. Confirm the trigger date with an advocate before relying on it.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <aside className="space-y-4">
            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <FileText className="size-4 text-brand" aria-hidden /> Attach documents
              </h2>
              <p className="mt-1 text-[11px] text-muted">Only checked files are included in the brief.</p>
              <div className="mt-2.5 space-y-2">
                {documents.slice(0, 6).map((d) => (
                  <Checkbox
                    key={d.id}
                    className="!p-2.5"
                    label={d.name}
                    description={`${d.sizeLabel} · ${d.caseTitle}`}
                    checked={attached.includes(d.id)}
                    onChange={(e) =>
                      setAttached((a) => (e.target.checked ? [...a, d.id] : a.filter((x) => x !== d.id)))
                    }
                  />
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <Scale className="size-4 text-brand" aria-hidden /> Share with
              </h2>
              <div className="mt-2.5 space-y-2">
                {advocates.slice(0, 3).map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setAdvocateId(a.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                      advocateId === a.id ? 'border-brand bg-brand-tint' : 'border-line hover:border-brand/30',
                    )}
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-card-bg text-[10px] font-bold text-brand ring-1 ring-line">
                      {a.initials}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-1 text-[12px] font-bold text-ink">
                        Adv. {a.name}
                        <BadgeCheck className="size-3 text-dot" aria-hidden />
                      </span>
                      <span className="text-[10px] text-muted">{a.practiceAreas[0]} · {a.city}</span>
                    </span>
                    <span className={cn('grid size-4 place-items-center rounded-full border', advocateId === a.id ? 'border-brand bg-brand text-card-bg' : 'border-line')}>
                      {advocateId === a.id && <Check className="size-2.5" aria-hidden />}
                    </span>
                  </button>
                ))}
                <Link href={dh("/advocates")} className="block pt-1 text-[11px] font-semibold text-brand hover:underline">
                  Choose a different advocate
                </Link>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <Lock className="size-4 text-brand" aria-hidden /> Before you share
              </h2>
              <Checkbox
                className="mt-2.5 !p-3"
                label="I consent to share this brief and the selected documents"
                description={`With Adv. ${advocate.name} for the purpose of a consultation. I can revoke access later.`}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <Button fullWidth className="mt-3" disabled={!consent} loading={sharing} onClick={share}>
                <Share2 className="size-4" aria-hidden /> Share with Adv. {advocate.name.split(' ')[0]}
              </Button>
              <p className="mt-2 text-center text-[10px] leading-4 text-muted">
                A consent row and a read-only snapshot are created. Nothing is shared before this step.
              </p>
            </Card>

            <div className="flex items-start gap-2 rounded-xl bg-brand-tint p-3.5">
              <X className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
              <p className="text-[10.5px] leading-4.5 text-muted">
                Briefs never include your phone number, email or other files unless you attach them.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
