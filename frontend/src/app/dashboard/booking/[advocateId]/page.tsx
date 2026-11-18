"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { getAdvocate } from '@/data/dashboard-mock-data';
import type { AdvocateSlot } from '@/types/dashboard';
import { getSlots, holdSlot, releaseHold, mockCheckout, createBooking, confirmPayment } from '@/services/dashboard/bookings';
import { formatDate, formatInr, nowMs, dh } from '@/lib/dashboard-utils';
import {
  Badge,
  Button,
  Card,
  Modal,
} from '@/components/dashboard/ui';
import {
  Disclaimer,
  PageHeader,
} from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';

const modes = [
  { key: 'video', label: 'Video', icon: Video, note: '30 min · from home' },
  { key: 'phone', label: 'Phone', icon: MessageSquare, note: '30 min · no video' },
  { key: 'in-person', label: 'In person', icon: MapPin, note: 'At the advocate’s office' },
] as const;

export default function BookingPage() {
  const params = useParams();
  const rawAdvocateId = params.advocateId;
  const advocateId = (Array.isArray(rawAdvocateId) ? rawAdvocateId[0] : rawAdvocateId) ?? 'adv_1';
  const router = useRouter();
  const advocate = getAdvocate(advocateId);

  const [mode, setMode] = useState<'video' | 'phone' | 'in-person'>('video')
  const [slots, setSlots] = useState<AdvocateSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdvocateSlot | null>(null)
  const [holdError, setHoldError] = useState('')
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(nowMs)
  const [payOpen, setPayOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  useEffect(() => {
    let active = true
    void getSlots(advocateId, mode).then((next) => {
      if (!active) return
      setSlots(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [advocateId, mode])

  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(nowMs()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  useEffect(() => () => { if (selected) releaseHold(selected.id) }, [selected])

  const byDate = useMemo(() => {
    const map = new Map<string, AdvocateSlot[]>()
    slots.forEach((s) => map.set(s.date, [...(map.get(s.date) ?? []), s]))
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0
  const holdActive = !!expiresAt && remaining > 0 && !!selected

  const choose = (slot: AdvocateSlot) => {
    setHoldError('')
    if (selected?.id === slot.id) return
    if (selected) releaseHold(selected.id)
    const res = holdSlot(slot)
    if (!res.ok) {
      setHoldError('That slot is on hold for another user. Please pick a different time.')
      return
    }
    setSelected(slot)
    setExpiresAt(res.expiresAt)
    setNow(nowMs())
  }

  const pay = async () => {
    if (!selected || !advocate) return
    setPaying(true)
    setPayError('')
    try {
      const { paymentId } = await mockCheckout(advocate.feeMin)
      const booking = await createBooking({
        advocateId: advocate.id,
        caseId: 'case_2041',
        slot: selected,
        mode,
        amount: advocate.feeMin,
      })
      const { status } = await confirmPayment(booking.id, paymentId)
      releaseHold(selected.id)
      setPayOpen(false)
      router.push(
        dh(`/booking/confirmation/${booking.id}`) +
          '?' +
          new URLSearchParams({ booking: JSON.stringify({ ...booking, status, paymentId }) })
      )
    } catch {
      setPayError('Payment confirmation failed. No amount was charged. Try again.')
    } finally {
      setPaying(false)
    }
  }

  if (!advocate) {
    return <p className="text-body">Advocate not found.</p>
  }

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Book a consultation"
        title={`Adv. ${advocate.name}`}
        subtitle={`${advocate.practiceAreas.join(' · ')} · ${advocate.city}`}
        backTo={dh(`/advocates/${advocate.id}`)}
        actions={<Badge tone="mint"><BadgeCheck className="size-3" /> Bar Council verified</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Mode */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-[13.5px] font-bold">1. Choose how to talk</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {modes.map((m) => {
                const available = advocate.modes.includes(m.key)
                const active = mode === m.key
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={!available}
                    onClick={() => { setMode(m.key); setSelected(null); setExpiresAt(null); setLoading(true) }}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border p-3 text-left transition',
                      active ? 'border-brand bg-brand-tint ring-1 ring-brand/20' : 'border-line hover:border-brand/30',
                      !available && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <m.icon className={cn('mt-0.5 size-4.5 shrink-0', active ? 'text-brand' : 'text-muted')} aria-hidden />
                    <span>
                      <span className="block text-[12.5px] font-bold text-ink">{m.label}</span>
                      <span className="block text-[10.5px] text-body">{m.note}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Slots */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13.5px] font-bold">2. Pick a free slot</h2>
                <p className="mt-0.5 text-[11px] text-body">Only free slots are shown. Slots are held for 10 minutes while you pay.</p>
              </div>
              {holdActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[10.5px] font-bold text-warn">
                  <Clock className="size-3" aria-hidden /> Held {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
                </span>
              )}
            </div>

            {holdError && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[11.5px] text-danger">{holdError}</p>}

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-[12px] text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {byDate.map(([date, daySlots]) => (
                  <div key={date}>
                    <p className="mb-2 text-[11px] font-bold text-body">
                      {formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => {
                        const active = selected?.id === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => choose(s)}
                            className={cn(
                              'h-10 min-w-[74px] rounded-lg border px-3 text-[12px] font-semibold transition',
                              active
                                ? 'border-brand bg-brand text-card-bg'
                                : 'border-line bg-card-bg text-ink hover:border-brand/50 hover:text-brand-dark',
                            )}
                          >
                            {s.time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center gap-2 rounded-xl bg-brand-tint px-3.5 py-3">
            <Lock className="size-4 shrink-0 text-muted" aria-hidden />
            <p className="text-[11px] leading-5 text-body">
              Double booking is prevented by a unique constraint on the slot and a 10-minute hold. Payment is only a
              mock in this build; no money is charged.
            </p>
          </div>
        </div>

        {/* Summary */}
        <aside className="space-y-4">
          <Card className="p-5 lg:sticky lg:top-20">
            <h2 className="text-[13.5px] font-bold">Consultation summary</h2>
            <div className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-body">Advocate</span>
                <span className="font-semibold text-ink">Adv. {advocate.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Mode</span>
                <span className="font-semibold capitalize text-ink">{mode.replace('-', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Slot</span>
                <span className="font-semibold text-ink">
                  {selected ? `${formatDate(selected.date, { day: 'numeric', month: 'short' })} · ${selected.time}` : 'Not selected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Duration</span>
                <span className="font-semibold text-ink">30 minutes</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-body">Fee</span>
                <span className="text-[16px] font-extrabold text-ink">{formatInr(advocate.feeMin)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Platform fee</span>
                <span className="font-semibold text-ink">{formatInr(49)}</span>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-mint-soft px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-dot">
                <ShieldCheck className="size-3" aria-hidden /> Fixed platform charge. No fee-sharing with advocates.
              </p>
            </div>

            <Button fullWidth className="mt-4" disabled={!holdActive} onClick={() => setPayOpen(true)}>
              <CreditCard className="size-4" aria-hidden /> Pay {formatInr(advocate.feeMin + 49)}
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted">
              {holdActive ? 'Your slot is held. Complete payment to confirm.' : 'Select a slot to continue.'}
            </p>
          </Card>

          <Disclaimer variant="banner" text="A consultation is an agreement between you and the advocate. Legal does not provide legal advice." />
        </aside>
      </div>

      {/* Mock checkout */}
      <Modal
        open={payOpen}
        onClose={() => !paying && setPayOpen(false)}
        title="Razorpay checkout (mock)"
        description="This is a sandbox checkout. No card or UPI details are collected."
        footer={
          <>
            <Button variant="ghost" disabled={paying} onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button loading={paying} onClick={pay}>
              {paying ? 'Confirming…' : `Pay ${formatInr(advocate.feeMin + 49)}`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                  <CreditCard className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-[12.5px] font-bold">Consultation with Adv. {advocate.name}</p>
                  <p className="text-[10.5px] text-muted">{mode} · 30 min</p>
                </div>
              </div>
              <p className="text-[16px] font-extrabold">{formatInr(advocate.feeMin + 49)}</p>
            </div>
          </div>
          <div className="rounded-xl bg-brand-tint p-3 text-[11px] leading-5 text-body">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Check className="size-3.5 text-dot" aria-hidden /> What happens after payment
            </p>
            <p className="mt-1">A mock webhook marks the booking confirmed. You get an .ics calendar file and the advocate receives your case brief.</p>
          </div>
          {payError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[11.5px] text-danger">{payError}</p>}
        </div>
      </Modal>
    </div>
  )
}
