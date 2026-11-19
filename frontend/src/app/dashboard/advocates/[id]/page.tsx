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
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Advocate dossier" backTo={dh('/advocates')} />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="ADVOCATE DOSSIER"
        title={`Adv. ${adv.name}`}
        subtitle={`${adv.practiceAreas.join(' · ')} · ${adv.city}`}
        backTo={dh('/advocates')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSaved((v) => !v)}>
              {saved ? (
                <><CheckCircle2 className="size-4" /> Saved</>
              ) : (
                <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Bookmark advocate</span></>
              )}
            </Button>
            <Button variant="secondary" onClick={() => router.push(dh('/messages'))}>
              <MessageSquare className="size-4" aria-hidden /> Secure Message
            </Button>
            <Button onClick={() => router.push(dh(`/booking/${adv.id}`))}>
              <span className="sm:hidden">Book</span>
              <span className="hidden sm:inline">Schedule Consultation</span>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start gap-5">
              <Avatar initials={adv.initials} size="xl" tone="brand" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-serif text-[24px] font-normal text-[#2a1c12]">{adv.name}</h2>
                  <Badge tone="mint"><BadgeCheck className="size-3" /> BCI Verified</Badge>
                </div>
                <p className="mt-1 text-[13px] text-[#5b4a3b]">
                  {adv.experienceYears} years of practice · {adv.casesHandled} matters handled on NyayaSetu
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#5b4a3b]">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-[#9a6a35]" aria-hidden /> {adv.city} · {adv.distanceKm} km</span>
                  <span className="inline-flex items-center gap-1.5"><Star className="size-3.5 fill-[#d1a46a] text-[#9a6a35]" aria-hidden /> {adv.rating} ({adv.reviewCount} client evaluations)</span>
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-[#85725f]" aria-hidden /> {adv.responseRate}% response rate</span>
                </div>
              </div>
            </div>

            <p className="mt-5 text-[13.5px] leading-relaxed text-[#5b4a3b]">{adv.about}</p>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 pt-6 border-t border-[#e2d5c1]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Practice Areas</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {adv.practiceAreas.map((a) => <Badge key={a} tone="brand">{a}</Badge>)}
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Spoken Languages</p>
                <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[#2a1c12]">
                  <Languages className="size-4 text-[#85725f]" aria-hidden />
                  {adv.languages.map((l) => spokenLanguageLabels[l]).join(', ')}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Court Appearances & Standing</p>
                <ul className="mt-2.5 space-y-1.5">
                  {adv.courts.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-[13px] text-[#2a1c12]">
                      <Scale className="size-3.5 text-[#9a6a35]" aria-hidden /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-serif text-[18px] font-normal text-[#2a1c12]">Client Evaluation Summary</h3>
            <p className="mt-1 text-[12px] text-[#85725f]">Only citizens with a completed consultation ledger may submit reviews.</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:text-left">
                <p className="font-serif text-[38px] leading-none font-normal text-[#2a1c12]">{adv.rating}</p>
                <div className="mt-1.5 flex justify-center gap-1 sm:justify-start">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={n <= Math.round(adv.rating) ? 'size-3.5 fill-[#d1a46a] text-[#9a6a35]' : 'size-3.5 text-[#e2d5c1]'} aria-hidden />
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-[#85725f]">{adv.reviewCount} verified reviews</p>
              </div>
              <div className="space-y-2">
                {[[5, 72], [4, 20], [3, 6], [2, 1], [1, 1]].map(([star, pct]) => (
                  <div key={star} className="flex items-center gap-2.5">
                    <span className="w-3 text-right font-mono text-[11px] text-[#85725f]">{star}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-[1px] bg-[#ebe1d1]">
                      <div className="h-full rounded-[1px] bg-[#9a6a35]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-[10px] text-[#85725f]">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Clear communication', 'Punctual & prepared', 'Fair statutory fee', 'Actionable next steps'].map((t) => (
                <Badge key={t} tone="neutral">{t}</Badge>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[#85725f]">
              Evaluations are strictly moderated under Bar Council guidelines. Claims regarding comparative superiority or guaranteed court outcomes are prohibited.
            </p>
          </Card>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Bar Council Compliance Notice</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5b4a3b]">
              This dossier presents neutral, factual records furnished by the advocate and verified by our compliance desk. It does not constitute commercial advertisement, solicitation, or a legal guarantee under BCI Rule 36.
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <Card className="p-6 lg:sticky lg:top-20">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 text-[#2a6b3b]">
                <BadgeCheck className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-serif text-[15px] font-normal text-[#2a1c12]">Bar Council Enrolment</p>
                <p className="font-mono text-[10px] text-[#85725f]">Verified on {formatDate(adv.enrolmentDate)}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-[12px]">
              <div className="flex justify-between gap-2 border-b border-[#e2d5c1] pb-2">
                <dt className="text-[#85725f]">Enrolment ID</dt>
                <dd className="font-mono font-medium text-[#2a1c12]">{adv.enrolmentNo}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#e2d5c1] pb-2">
                <dt className="text-[#85725f]">State Bar Council</dt>
                <dd className="text-right font-medium text-[#2a1c12]">{adv.stateBarCouncil}</dd>
              </div>
            </dl>

            <div className="my-5 border-t border-[#e2d5c1]" />

            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Consultation Fee</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-serif text-[26px] font-normal text-[#2a1c12]">
              {formatInr(adv.feeMin)} <span className="font-sans text-[13px] text-[#85725f]">onwards</span>
            </p>
            <p className="text-[11.5px] text-[#85725f]">Statutory scale: {formatInr(adv.feeMin)}–{formatInr(adv.feeMax)} per 30 minutes</p>

            <div className="mt-4 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#85725f]">Next Open Docket</p>
              <p className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-[#2a1c12]">
                <CalendarClock className="size-4 text-[#9a6a35]" aria-hidden />
                {new Date(adv.nextAvailable).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {adv.modes.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#5b4a3b]">
                    {m === 'video' ? <Video className="size-3 text-[#9a6a35]" /> : m === 'phone' ? <MessageSquare className="size-3 text-[#9a6a35]" /> : <MapPin className="size-3 text-[#9a6a35]" />}
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <Button fullWidth className="mt-5" onClick={() => router.push(dh(`/booking/${adv.id}`))}>
              Schedule Consultation
            </Button>
            <Button fullWidth variant="secondary" className="mt-2.5" onClick={() => router.push(dh('/messages'))}>
              <MessageSquare className="size-4" aria-hidden /> Send Preliminary Note
            </Button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[10.5px] text-[#85725f]">
              <IndianRupee className="size-3" aria-hidden /> No fee-sharing or referral commissions collected.
            </p>
          </Card>

          <Disclaimer variant="banner" text="Informational record only. Scheduling a consultation creates a direct professional engagement between citizen and advocate." />

          <Link href={dh('/advocates')} className="flex items-center justify-between rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-4 py-3 text-[12px] font-medium text-[#5b4a3b] transition hover:border-[#9a6a35] hover:text-[#2a1c12]">
            <span className="inline-flex items-center gap-2"><Briefcase className="size-4 text-[#9a6a35]" aria-hidden /> Return to matching ledger</span>
            <Dot />
          </Link>
        </aside>
      </div>
    </div>
  );
}
