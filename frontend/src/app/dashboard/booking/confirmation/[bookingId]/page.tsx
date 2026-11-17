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
    <Suspense fallback={<p className="text-body">Loading booking…</p>}>
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
    return <p className="text-body">Booking not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade">
      <div className="mb-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-mint">
          <CheckCircle2 className="size-8 text-dot" aria-hidden />
        </span>
        <h1 className="mt-4 text-[26px] font-extrabold sm:text-[30px]">Consultation confirmed</h1>
        <p className="mt-2 text-[13.5px] leading-6 text-body">
          Your slot is booked with Adv. {booking.advocateName}. A calendar file and the case brief have been prepared.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Badge tone="mint"><CheckCircle2 className="size-3" /> {booking.status.replace('_', ' ')}</Badge>
          <Badge tone="outline">Ref {booking.id}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-brand-tint px-5 py-4">
          <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Appointment</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <CalendarPlus className="size-4 text-brand" aria-hidden />
              {formatDate(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-body">
              <Clock className="size-4" aria-hidden /> {booking.time} · 30 minutes
            </span>
            <span className="inline-flex items-center gap-1.5 text-body capitalize">
              <Video className="size-4" aria-hidden /> {booking.mode.replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {[
            ['Advocate', `Adv. ${booking.advocateName}`],
            ['Amount paid', formatInr(booking.amount)],
            ['Payment reference', booking.paymentId ?? 'pay_mock_pending'],
            ['Case brief', 'Shared with your consent'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-brand-tint px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted uppercase">{label}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row">
          <Button fullWidth onClick={() => downloadIcs(booking)}>
            <Download className="size-4" aria-hidden /> Download .ics calendar file
          </Button>
          <Button fullWidth variant="secondary" onClick={() => router.push(dh('/messages'))}>
            <MessageSquare className="size-4" aria-hidden /> Message advocate
          </Button>
        </div>
      </Card>

      <div className="mt-4 rounded-2xl border border-line p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-bold">
          <ShieldCheck className="size-4 text-dot" aria-hidden /> What happens next
        </p>
        <ol className="mt-2 space-y-1.5">
          {[
            'The advocate reviews your brief and can ask for more information.',
            'You will get a reminder 24 hours and 1 hour before the consultation.',
            'Join from Messages. Phone consultations use a masked number.',
            'After the consultation, you can leave feedback if the booking is marked completed.',
          ].map((s, i) => (
            <li key={s} className="flex gap-2 text-[11.5px] leading-5 text-body">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-dark">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Disclaimer />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => router.push(dh('/bookings'))}>My bookings</Button>
          <Button size="sm" variant="secondary" onClick={() => router.push(dh('/dashboard'))}>Back to home</Button>
        </div>
      </div>
    </div>
  )
}
