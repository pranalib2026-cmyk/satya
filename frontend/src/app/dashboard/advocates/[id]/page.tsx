"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  IndianRupee,
  Languages,
  MapPin,
  MessageSquare,
  Scale,
  Star,
  Video,
} from 'lucide-react';
import { getAdvocateById } from '@/services/dashboard/advocates';
import { spokenLanguageLabels } from '@/data/dashboard-mock-data';
import { formatDate, formatInr, dh } from '@/lib/dashboard-utils';
import type { Advocate } from '@/types/dashboard';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dot,
  SkeletonCard,
} from '@/components/dashboard/ui';
import {
  Disclaimer,
  PageHeader,
} from '@/components/dashboard/shared';

export default function AdvocateProfilePage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? '';
  const router = useRouter();
  const [adv, setAdv] = useState<Advocate | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) void getAdvocateById(id).then((a) => setAdv(a ?? null));
  }, [id]);

  if (!adv) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <PageHeader title="Advocate profile" backTo={dh('/advocates')} />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <PageHeader
        title={`Adv. ${adv.name}`}
        subtitle={`${adv.practiceAreas.join(' · ')} · ${adv.city}`}
        backTo={dh('/advocates')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSaved((v) => !v)}>
              {saved ? (
                <><CheckCircle2 className="size-4" /> Saved</>
              ) : (
                <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save advocate</span></>
              )}
            </Button>
            <Button variant="secondary" onClick={() => router.push(dh('/messages'))}>
              <MessageSquare className="size-4" aria-hidden /> Message
            </Button>
            <Button onClick={() => router.push(dh(`/booking/${adv.id}`))}>
              <span className="sm:hidden">Book</span>
              <span className="hidden sm:inline">Book consultation</span>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar initials={adv.initials} size="xl" tone="brand" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[20px] font-extrabold">{adv.name}</h2>
                  <Badge tone="mint"><BadgeCheck className="size-3" /> Verified</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-body">
                  {adv.experienceYears} years of practice · {adv.casesHandled} matters handled on Legal
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-body">
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {adv.city} · {adv.distanceKm} km</span>
                  <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-gold text-gold" aria-hidden /> {adv.rating} ({adv.reviewCount} verified reviews)</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {adv.responseRate}% response rate</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-6 text-body">{adv.about}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Practice areas</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {adv.practiceAreas.map((a) => <Badge key={a} tone="brand">{a}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Languages</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink">
                  <Languages className="size-3.5 text-muted" aria-hidden />
                  {adv.languages.map((l) => spokenLanguageLabels[l]).join(', ')}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Courts</p>
                <ul className="mt-1.5 space-y-1">
                  {adv.courts.map((c) => (
                    <li key={c} className="flex items-center gap-1.5 text-[12.5px] text-ink">
                      <Scale className="size-3.5 text-brand" aria-hidden /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-bold">Verified rating summary</h3>
            <p className="mt-1 text-[11.5px] text-muted">Only clients with a completed booking can leave feedback.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:text-left">
                <p className="text-[34px] leading-none font-extrabold">{adv.rating}</p>
                <div className="mt-1 flex justify-center gap-0.5 sm:justify-start">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={n <= Math.round(adv.rating) ? 'size-3.5 fill-gold text-gold' : 'size-3.5 text-border-hover'} aria-hidden />
                  ))}
                </div>
                <p className="mt-1 text-[10.5px] text-muted">{adv.reviewCount} reviews</p>
              </div>
              <div className="space-y-1.5">
                {[[5, 72], [4, 20], [3, 6], [2, 1], [1, 1]].map(([star, pct]) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-3 text-right text-[10.5px] text-muted">{star}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-tint">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-7 text-right text-[10px] text-muted">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['Clear communication', 'On time', 'Fair fee', 'Explained next steps'].map((t) => (
                <Badge key={t} tone="neutral">{t}</Badge>
              ))}
            </div>
            <p className="mt-3 text-[10.5px] leading-4.5 text-muted">
              Feedback is moderated. We do not display claims about success rates or comparisons with other advocates.
            </p>
          </Card>

          <div className="rounded-2xl border border-line bg-brand-tint p-4">
            <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Profile wording</p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-body">
              This profile uses neutral, factual information provided by the advocate and verified by our team. It is not
              an advertisement, a recommendation of quality, or a claim about outcomes.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5 lg:sticky lg:top-20">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-mint text-dot">
                <BadgeCheck className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-[12.5px] font-bold">Bar Council enrolment verified</p>
                <p className="text-[10.5px] text-muted">Checked on {formatDate(adv.enrolmentDate)}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-[11.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Enrolment no.</dt>
                <dd className="font-semibold text-ink">{adv.enrolmentNo}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">State Bar Council</dt>
                <dd className="text-right font-semibold text-ink">{adv.stateBarCouncil}</dd>
              </div>
            </dl>

            <div className="my-4 border-t border-line" />

            <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Consultation fee</p>
            <p className="mt-1 flex items-center gap-1 text-[22px] font-extrabold">
              {formatInr(adv.feeMin)} <span className="text-[13px] font-semibold text-muted">onwards</span>
            </p>
            <p className="text-[11px] text-muted">Typical range {formatInr(adv.feeMin)}–{formatInr(adv.feeMax)} for 30 minutes</p>

            <div className="mt-3 rounded-xl bg-brand-tint p-3">
              <p className="text-[10.5px] font-semibold text-muted uppercase">Next availability</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <CalendarClock className="size-3.5 text-brand" aria-hidden />
                {new Date(adv.nextAvailable).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {adv.modes.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded-full bg-card-bg px-2 py-0.5 text-[10px] font-semibold text-body ring-1 ring-line">
                    {m === 'video' ? <Video className="size-3" /> : m === 'phone' ? <MessageSquare className="size-3" /> : <MapPin className="size-3" />}
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <Button fullWidth className="mt-4" onClick={() => router.push(dh(`/booking/${adv.id}`))}>
              Book consultation
            </Button>
            <Button fullWidth variant="secondary" className="mt-2" onClick={() => router.push(dh('/messages'))}>
              <MessageSquare className="size-4" aria-hidden /> Message
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted">
              <IndianRupee className="size-3" aria-hidden /> Platform fee is separate. No fee-sharing with advocates.
            </p>
          </Card>

          <Disclaimer variant="banner" text="Legal information only. Booking a consultation creates a separate agreement between you and the advocate." />

          <Link href={dh('/advocates')} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-[12px] font-semibold text-body transition hover:border-brand/30 hover:text-ink">
            <span className="inline-flex items-center gap-1.5"><Briefcase className="size-4" aria-hidden /> Back to all matches</span>
            <Dot />
          </Link>
        </aside>
      </div>
    </div>
  )
}
