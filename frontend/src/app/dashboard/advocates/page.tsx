"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  ChevronDown,
  Filter,
  IndianRupee,
  Languages,
  MapPin,
  RefreshCw,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Input,
  Select,
  SkeletonCard,
  Tabs,
} from '@/components/dashboard/ui';
import {
  AdvocateCard,
  Disclaimer,
  PageHeader,
  ServiceError,
} from '@/components/dashboard/shared';
import { matchAdvocates, practiceAreas, sortMatches, weights, type MatchPreferences } from '@/services/dashboard/advocates';
import { loadCaseProfile } from '@/services/dashboard/intake';
import { cases, languageLabels } from '@/data/dashboard-mock-data';
import type { AdvocateMatch, Language } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { dh } from '@/lib/dashboard-utils';

type Sort = 'recommended' | 'nearest' | 'fee' | 'experience';

export default function AdvocatesPage() {
  const router = useRouter();
  const profile = typeof window !== 'undefined' ? loadCaseProfile() ?? cases[0] : cases[0];
  const [prefs, setPrefs] = useState<MatchPreferences>({
    practiceArea: profile.category,
    budgetMax: 3000,
    language: 'en',
    mode: 'any',
    gender: 'any',
  })
  const [draft, setDraft] = useState<MatchPreferences>(prefs)
  const [matches, setMatches] = useState<AdvocateMatch[]>([])
  const [noLocal, setNoLocal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<Sort>('recommended')
  const [showHow, setShowHow] = useState(false)

  const search = async (p: MatchPreferences) => {
    setLoading(true)
    setError('')
    try {
      const res = await matchAdvocates(p, p.practiceArea ?? profile.category)
      setMatches(res.matches)
      setNoLocal(res.noLocalMatch)
      setPrefs(p)
      setSort('recommended')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load advocate matches.')
    } finally {
      setLoading(false)
    }
  }

  const [initialPrefs] = useState(prefs)
  const [initialCategory] = useState(profile.category)

  useEffect(() => {
    let cancelled = false
    void matchAdvocates(initialPrefs, initialPrefs.practiceArea ?? initialCategory)
      .then((res) => {
        if (cancelled) return
        setMatches(res.matches)
        setNoLocal(res.noLocalMatch)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load advocate matches.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [initialPrefs, initialCategory])

  const sorted = useMemo(() => sortMatches(matches, sort), [matches, sort])

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Advocate matching"
        title="Find the right advocate for your case"
        subtitle="Filtered by verified status, practice area, language and mode — then scored on fit, court proximity, experience, rating and availability."
        actions={
          <Badge tone="mint">
            <Sparkles className="size-3" aria-hidden /> {matches.length} matches
          </Badge>
        }
      />

      {error && <ServiceError message={error} onRetry={() => void search(prefs)} className="mb-4" />}

      {noLocal && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Video className="mt-0.5 size-4.5 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="text-[13px] font-bold text-warn">No advocate matched every local filter</p>
              <p className="text-[11.5px] leading-5 text-body">
                These verified advocates offer remote consultations and can appear before your forum where permitted.
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void search({ ...prefs, mode: 'video' })}>
            Show remote only
          </Button>
        </div>
      )}

      {/* Preferences */}
      <Card className="mb-5 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
            <Filter className="size-4 text-brand" aria-hidden /> Your preferences
          </h2>
          <span className="text-[10.5px] text-muted">Payment never affects ranking</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Practice area" htmlFor="area">
            <Select id="area" value={draft.practiceArea} onChange={(e) => setDraft({ ...draft, practiceArea: e.target.value })}>
              {practiceAreas.map((a) => <option key={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="Maximum budget (₹)" htmlFor="budget">
            <Input
              id="budget"
              inputMode="numeric"
              value={draft.budgetMax}
              onChange={(e) => setDraft({ ...draft, budgetMax: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            />
          </Field>
          <Field label="Language" htmlFor="lang">
            <Select id="lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as Language | 'any' })}>
              <option value="any">Any language</option>
              {(Object.keys(languageLabels) as Language[]).map((l) => (
                <option key={l} value={l}>{languageLabels[l]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Consultation mode" htmlFor="mode">
            <Select id="mode" value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as MatchPreferences['mode'] })}>
              <option value="any">Any mode</option>
              <option value="video">Video</option>
              <option value="phone">Phone</option>
              <option value="in-person">In person</option>
            </Select>
          </Field>
          <Field label="Gender preference (optional)" htmlFor="gender">
            <Select id="gender" value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value as MatchPreferences['gender'] })}>
              <option value="any">No preference</option>
              <option value="female">Female advocate</option>
              <option value="male">Male advocate</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <MapPin className="size-3.5" aria-hidden /> Showing advocates for {profile.probableForum}
          </p>
          <Button size="sm" loading={loading} onClick={() => void search(draft)}>
            <RefreshCw className="size-3.5" aria-hidden /> Update matches
          </Button>
        </div>
      </Card>

      {/* Results header */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-bold">
            {loading ? 'Matching advocates…' : `Top ${sorted.length} matches`}
            <span className="ml-2 text-[12px] font-medium text-body">for {prefs.practiceArea}</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">Ranked by fit, not by who pays more.</p>
        </div>
        <Tabs
          size="sm"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[
            { value: 'recommended', label: 'Recommended' },
            { value: 'nearest', label: 'Nearest' },
            { value: 'fee', label: 'Lowest fee' },
            { value: 'experience', label: 'Experience' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 pb-4">
        {['Tenancy', 'Property', 'Consumer', 'Cheque bounce', 'Family', 'Employment'].map((area) => (
          <Chip
            key={area}
            active={prefs.practiceArea === area}
            onClick={() => {
              const next = { ...prefs, practiceArea: area }
              setDraft(next)
              void search(next)
            }}
          >
            {area}
          </Chip>
        ))}
        <Chip onClick={() => setShowHow((v) => !v)}>
          How matching works <ChevronDown className={cn('size-3 transition', showHow && 'rotate-180')} />
        </Chip>
      </div>

      {showHow && (
        <div className="mb-4 rounded-2xl border border-line bg-brand-tint p-4 animate-in-up">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['Practice fit', 30, weights.practice_fit],
              ['Court proximity', 20, weights.court_proximity],
              ['Experience', 15, weights.experience],
              ['Language', 10, weights.language],
              ['Ratings & response', 15, weights.rating_response],
              ['Budget & availability', 10, weights.budget_availability],
            ].map(([label, pct]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-lg bg-card-bg px-3 py-2 text-[11.5px]">
                <span className="text-body">{label}</span>
                <span className="font-bold text-ink">{pct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-4.5 text-muted">
            <BadgeCheck className="mt-px size-3.5 shrink-0 text-dot" aria-hidden />
            Weights are read from the config table. Fee is used only as your budget constraint — never as a ranking boost.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
          : sorted.map((m, i) => (
              <AdvocateCard key={m.advocate.id} match={m} rank={i + 1} onBook={() => router.push(dh(`/booking/${m.advocate.id}`))} />
            ))}
      </div>

      {!loading && (
        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl bg-brand-soft p-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
              <IndianRupee className="size-4 text-brand" aria-hidden /> Not sure who to pick?
            </p>
            <p className="mt-0.5 text-[11.5px] text-body">
              Prepare a case brief first. Every advocate you contact receives the same facts, so you never repeat yourself.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push(dh('/brief'))}>Prepare brief</Button>
            <Button size="sm" onClick={() => router.push(dh('/triage'))}>Review triage</Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Disclaimer />
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Languages className="size-3.5" aria-hidden /> Profiles are factual. No ratings are paid for.
        </p>
      </div>
    </div>
  )
}
