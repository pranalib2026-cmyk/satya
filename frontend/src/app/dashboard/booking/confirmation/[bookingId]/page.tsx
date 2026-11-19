"use client";

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { getBooking, downloadIcs } from '@/services/dashboard/bookings';
import type { Booking } from '@/types/dashboard';
import { formatDate, formatInr, dh } from '@/lib/dashboard-utils';
import {
  Badge,
  Button,
  Card,
} from '@/components/dashboard/ui';
import { Disclaimer } from '@/components/dashboard/shared';

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<p className="text-[#5b4a3b]">Retrieving appointment receipt…</p>}>
      <BookingConfirmationContent />
    </Suspense>
  );
}

function BookingConfirmationContent() {
  const params = useParams();
  const rawBookingId = params.bookingId;
  const bookingId = (Array.isArray(rawBookingId) ? rawBookingId[0] : rawBookingId) ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingParam = searchParams.get('booking');
  let stateBooking: Booking | undefined;
  if (bookingParam) {
    try {
      stateBooking = JSON.parse(bookingParam) as Booking;
    } catch {
      stateBooking = undefined;
    }
  }
  const [booking, setBooking] = useState<Booking | null>(stateBooking ?? null);

  useEffect(() => {
    if (!booking) void getBooking(bookingId).then((b) => setBooking(b ?? null));
  }, [booking, bookingId]);

  if (!booking) {
    return <p className="text-[#5b4a3b]">Appointment record not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade space-y-6">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 text-[#2a6b3b]">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Official Record of Booking</p>
        <h1 className="mt-1 font-serif text-[32px] sm:text-[36px] font-normal text-[#2a1c12]">Consultation Sealed</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#5b4a3b]">
          Docket slot reserved with Adv. {booking.advocateName}. Your preliminary matter dossier has been prepared for transmission.
        </p>
        <div className="mt-4 flex justify-center gap-2.5">
          <Badge tone="mint"><CheckCircle2 className="size-3" /> {booking.status.replace('_', ' ').toUpperCase()}</Badge>
          <Badge tone="neutral">REF #{booking.id}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[#e2d5c1] bg-[#ebe1d1]/20 px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Docket Details</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span className="inline-flex items-center gap-2 font-medium text-[#2a1c12]">
              <CalendarPlus className="size-4 text-[#9a6a35]" aria-hidden />
              {formatDate(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#5b4a3b]">
              <Clock className="size-4 text-[#85725f]" aria-hidden /> {booking.time} · 30 min
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium capitalize text-[#5b4a3b]">
              <Video className="size-4 text-[#85725f]" aria-hidden /> {booking.mode.replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {[
            ['Appointed Advocate', `Adv. ${booking.advocateName}`],
            ['Authorized Fee', formatInr(booking.amount)],
            ['Gateway Reference', booking.paymentId ?? 'pay_sandbox_confirmed'],
            ['Matter Dossier', 'Secured under DPDP consent'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#85725f]">{label}</p>
              <p className="mt-1 font-serif text-[15px] font-normal text-[#2a1c12]">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e2d5c1] p-6 sm:flex-row">
          <Button fullWidth onClick={() => downloadIcs(booking)}>
            <Download className="size-4" aria-hidden /> Download .ics Calendar File
          </Button>
          <Button fullWidth variant="secondary" onClick={() => router.push(dh('/messages'))}>
            <MessageSquare className="size-4" aria-hidden /> Enter Messages Channel
          </Button>
        </div>
      </Card>

      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6">
        <p className="flex items-center gap-2 font-serif text-[15px] font-normal text-[#2a1c12]">
          <ShieldCheck className="size-4 text-[#2a6b3b]" aria-hidden /> Procedural Steps Ahead
        </p>
        <ol className="mt-3 space-y-2.5">
          {[
            'The advocate scrutinizes your submitted facts and may request clarifying documents.',
            'Cryptographic reminders will dispatch 24 hours and 1 hour prior to hearing time.',
            'Join directly through the encrypted portal. Telephonic consultations route through a masked relay.',
            'Following conclusion of proceedings, a formal evaluation receipt may be recorded.',
          ].map((s, i) => (
            <li key={s} className="flex gap-2.5 text-[12px] leading-relaxed text-[#5b4a3b]">
              <span className="grid size-4 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] font-mono text-[9px] font-medium text-[#2a1c12]">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Disclaimer />
        <div className="flex gap-2.5">
          <Button size="sm" variant="secondary" onClick={() => router.push(dh('/bookings'))}>Consultation Register</Button>
          <Button size="sm" variant="primary" onClick={() => router.push(dh('/dashboard'))}>Return to Chamber</Button>
        </div>
      </div>
    </div>
  );
}
