"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Handshake,
  Info,
  MapPin,
  Phone,
  Scale,
  Siren,
  Sparkles,
} from "lucide-react";
import { Button, Card, Badge, Field, Input, Select } from "@/components/dashboard/ui";
import { Disclaimer, PageHeader } from "@/components/dashboard/shared";
import { loadCaseProfile } from "@/services/dashboard/intake";
import { runTriage } from "@/services/dashboard/triage";
import { cases, dlsa } from "@/data/dashboard-mock-data";
import type { TriagePath } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";

const ICONS = {
  'self-help': FileText,
  'legal-aid': Handshake,
  advocate: Scale,
  emergency: Siren,
} as const

const TONES: Record<TriagePath['key'], string> = {
  'self-help': 'bg-mint text-dot',
  'legal-aid': 'bg-warn-soft text-warn',
  advocate: 'bg-brand-soft text-brand',
  emergency: 'bg-danger-soft text-danger',
}

export default function TriagePage() {
  const router = useRouter()
  const profile = loadCaseProfile() ?? cases[0]
  const [result] = useState(() => runTriage({ profile, annualIncome: 600000 }))
  const [selected, setSelected] = useState<TriagePath['key']>(result.recommended)

  const [income, setIncome] = useState('')
  const [category, setCategory] = useState('general')
  const [checked, setChecked] = useState(false)

  const eligible =
    category !== 'general' || (!!income && Number(income.replace(/[^\d]/g, '')) <= 300000)

  const path = result.paths.find((p) => p.key === selected) ?? result.paths[0]

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Triage result"
        title="What we suggest you do next"
        subtitle="Based on your case profile and a fixed set of rules — not an AI guess, and no payment influence."
        backTo={dh('/intake')}
        actions={
          <Badge tone="brand" className="h-7">
            <Sparkles className="size-3" aria-hidden /> {Math.round(result.confidence * 100)}% confidence
          </Badge>
        }
      />

      <div className="mb-5 rounded-2xl border border-line bg-brand-tint p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
          <p><span className="font-semibold text-ink">Case:</span> {profile.title}</p>
          <p><span className="font-semibold text-ink">Urgency:</span> {profile.urgency}</p>
          <p><span className="font-semibold text-ink">Complexity:</span> {profile.complexity.replaceAll('-', ' ')}</p>
          <Link href={dh("/intake")} className="ml-auto font-semibold text-brand hover:underline">
            Edit case profile
          </Link>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {result.rules.map((r) => (
            <span key={r} className="rounded-full bg-card-bg px-2.5 py-1 text-[10.5px] font-medium text-body ring-1 ring-line">
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {result.paths.map((p) => {
          const Icon = ICONS[p.key]
          const active = selected === p.key
          return (
            <button
              type="button"
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={cn(
                'relative flex flex-col rounded-2xl border p-4 text-left transition sm:p-5',
                active
                  ? 'border-brand bg-card-bg shadow-pop ring-4 ring-brand/10'
                  : 'border-line bg-card-bg hover:border-brand/30',
              )}
              aria-pressed={active}
            >
              {p.recommended && (
                <span className="absolute top-3.5 right-3.5 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-dot">
                  Recommended
                </span>
              )}
              <span className={cn('grid size-10 place-items-center rounded-xl', TONES[p.key])}>
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-[15.5px] font-bold">{p.title}</h3>
              <p className="mt-1 text-[12.5px] leading-5 text-body">{p.description}</p>
              {p.recommended && (
                <p className="mt-2.5 rounded-lg bg-mint-soft px-2.5 py-2 text-[11.5px] leading-4.5 text-dot">
                  <span className="font-bold">Why we suggest this: </span>
                  {p.reason}
                </p>
              )}
              <span className="mt-auto pt-3 text-[11.5px] font-bold text-brand">Select this path →</span>
            </button>
          )
        })}
      </div>

      {/* Selected path detail */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">You selected</p>
            <h2 className="mt-1 text-[19px] font-extrabold">{path.title}</h2>
          </div>
          <Badge tone={selected === result.recommended ? 'mint' : 'neutral'}>
            {selected === result.recommended ? 'Our recommendation' : 'Your choice'}
          </Badge>
        </div>

        {selected === 'self-help' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[13px] leading-6 text-body">
                Start with a reviewed template. Send a legal notice or file an RTI/consumer complaint yourself. The
                template includes where to file, the fee and the documents to attach.
              </p>
              <p className="mt-2 text-[11px] text-muted">Templates are drafts. Advocate review is recommended before filing.</p>
            </div>
            <Button onClick={() => router.push(dh('/self-help'))}>
              Open self-help tools <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {selected === 'advocate' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[13px] leading-6 text-body">
                Get matched with verified advocates who practise in your forum, speak your language and fit your
                budget. You will see a plain-language reason for every match.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <Info className="size-3.5" aria-hidden /> Payment never affects ranking.
              </p>
            </div>
            <Button onClick={() => router.push(dh('/advocates'))}>
              Find advocates near me <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {selected === 'emergency' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[13px] leading-6 text-body">
                If there is immediate danger, do not wait for an AI answer. Call 112 now. The emergency page works
                without AI, on a slow connection, and lists 112, 181 and 15100.
              </p>
            </div>
            <Button variant="danger" onClick={() => router.push(dh('/emergency'))}>
              <Siren className="size-4" aria-hidden /> Open emergency help
            </Button>
          </div>
        )}

        {selected === 'legal-aid' && (
          <div className="mt-4">
            <p className="text-[13px] leading-6 text-body">
              Free representation may be available through the District Legal Services Authority. Check the short
              eligibility criteria below.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Annual household income" htmlFor="income">
                <Input
                  id="income"
                  inputMode="numeric"
                  placeholder="e.g. 240000"
                  value={income}
                  onChange={(e) => {
                    setIncome(e.target.value)
                    setChecked(false)
                  }}
                />
              </Field>
              <Field label="Category" htmlFor="category">
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setChecked(false)
                  }}
                >
                  <option value="general">General</option>
                  <option value="scst">Scheduled Caste / Scheduled Tribe</option>
                  <option value="woman">Woman</option>
                  <option value="child">Child</option>
                  <option value="disability">Person with disability</option>
                  <option value="custody">Person in custody</option>
                </Select>
              </Field>
              <Button variant="secondary" onClick={() => setChecked(true)} disabled={!income && category === 'general'}>
                Check eligibility
              </Button>
            </div>

            {checked && (
              <div className={cn('mt-4 rounded-2xl border p-4', eligible ? 'border-dot/30 bg-mint-soft' : 'border-line bg-brand-tint')}>
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                  {eligible ? <CheckCircle2 className="size-4 text-dot" /> : <Info className="size-4 text-muted" />}
                  {eligible ? 'You may be eligible for free legal aid' : 'Free legal aid may not apply on these facts'}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-body">
                  {eligible
                    ? 'Bring an identity proof, address proof and any documents about your case to the DLSA front office. Eligibility is finally decided by the DLSA.'
                    : 'You can still call 15100 to confirm, or use the self-help templates. Income limits and categories vary by State.'}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
                    <Handshake className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-bold">{dlsa.authority}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-5 text-body">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {dlsa.address}
                    </p>
                    <p className="text-[12px] text-body">{dlsa.hours}</p>
                  </div>
                </div>
                <a
                  href="tel:15100"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-mint px-4 text-[13px] font-bold text-dot transition hover:bg-mint-strong"
                >
                  <Phone className="size-4" aria-hidden /> Call 15100
                </a>
              </div>
              <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                {dlsa.eligibility.slice(0, 4).map((e) => (
                  <p key={e} className="flex items-start gap-1.5 text-[11.5px] leading-5 text-body">
                    <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-dot" aria-hidden /> {e}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Disclaimer />
        <Button variant="ghost" size="sm" onClick={() => router.push(dh('/brief'))}>
          Prepare case brief <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
