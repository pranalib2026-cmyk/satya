"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarPlus, CheckCircle2, Clock, Download, MessageSquare, Star } from 'lucide-react';
import { listBookings, downloadIcs } from '@/services/dashboard/bookings';
import type { Booking } from '@/types/dashboard';
import { formatDate, formatInr, dh } from '@/lib/dashboard-utils';
import {
  Badge,
  Button,
  EmptyState,
  Tabs,
} from '@/components/dashboard/ui';
import { PageHeader } from '@/components/dashboard/shared';

const statusTone = {
  pending_payment: 'warn',
  confirmed: 'mint',
  completed: 'brand',
  cancelled: 'neutral',
  refunded: 'neutral',
} as const;

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    void listBookings().then(setBookings)
  }, [])

  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending_payment')
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled' || b.status === 'refunded')
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Bookings"
        title="Your consultations"
        subtitle="Upcoming appointments, past consultations and feedback. Payment is mocked in this build."
        backTo={dh('/')}
      />

      <div className="mb-4 flex items-center justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Past', count: past.length },
          ]}
        />
        <Button size="sm" variant="secondary" onClick={() => router.push(dh('/advocates'))}>
          Book another
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title={tab === 'upcoming' ? 'No upcoming consultations' : 'No past consultations'}
          body="Find a verified advocate and book a 30-minute consultation."
          action={<Button onClick={() => router.push(dh('/advocates'))}>Find an advocate</Button>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <div key={b.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-[12px] font-extrabold text-brand-dark">
                    {new Date(b.date).getDate()}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">Adv. {b.advocateName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-body">
                      <span className="inline-flex items-center gap-1"><CalendarPlus className="size-3.5" aria-hidden /> {formatDate(b.date, { day: 'numeric', month: 'short' })}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {b.time}</span>
                      <span className="capitalize">{b.mode.replace('-', ' ')}</span>
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted">Ref {b.id} · {formatInr(b.amount)}</p>
                  </div>
                </div>
                <Badge tone={statusTone[b.status]}>{b.status.replace('_', ' ')}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {b.status === 'confirmed' && (
                  <>
                    <Button size="sm" onClick={() => router.push(dh('/messages'))}>
                      <MessageSquare className="size-3.5" aria-hidden /> Open messages
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => downloadIcs(b)}>
                      <Download className="size-3.5" aria-hidden /> Add to calendar
                    </Button>
                  </>
                )}
                {b.status === 'completed' && !b.feedbackGiven && (
                  <Button size="sm" onClick={() => router.push(dh(`/feedback/${b.id}`))}>
                    <Star className="size-3.5" aria-hidden /> Leave feedback
                  </Button>
                )}
                {b.status === 'completed' && b.feedbackGiven && (
                  <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-body">
                    <CheckCircle2 className="size-3.5 text-dot" aria-hidden /> Feedback submitted. Thank you.
                  </p>
                )}
                <Button size="sm" variant="ghost" onClick={() => router.push(dh(`/booking/${b.advocateId}`))}>
                  Book again
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 text-[11px] text-muted">
        Need to change a booking? Message the advocate or write to{' '}
        <Link href={dh('/profile')} className="font-semibold text-brand hover:underline">grievances</Link>.
      </p>
    </div>
  )
}
