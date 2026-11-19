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
  { key: 'video', label: 'Video Hearing', icon: Video, note: '30 min · secure portal' },
  { key: 'phone', label: 'Audio Consultation', icon: MessageSquare, note: '30 min · direct line' },
  { key: 'in-person', label: 'Chambers Conference', icon: MapPin, note: 'In-person at advocate office' },
] as const;

export default function BookingPage() {
  const params = useParams();
  const rawAdvocateId = params.advocateId;
  const advocateId = (Array.isArray(rawAdvocateId) ? rawAdvocateId[0] : rawAdvocateId) ?? 'adv_1';
  const router = useRouter();
  const advocate = getAdvocate(advocateId);

  const [mode, setMode] = useState<'video' | 'phone' | 'in-person'>('video');
  const [slots, setSlots] = useState<AdvocateSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdvocateSlot | null>(null);
  const [holdError, setHoldError] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(nowMs);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    let active = true;
    void getSlots(advocateId, mode).then((next) => {
      if (!active) return;
      setSlots(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [advocateId, mode]);

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => () => { if (selected) releaseHold(selected.id); }, [selected]);

  const byDate = useMemo(() => {
    const map = new Map<string, AdvocateSlot[]>();
    slots.forEach((s) => map.set(s.date, [...(map.get(s.date) ?? []), s]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const remaining = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const holdActive = !!expiresAt && remaining > 0 && !!selected;

  const choose = (slot: AdvocateSlot) => {
    setHoldError('');
    if (selected?.id === slot.id) return;
    if (selected) releaseHold(selected.id);
    const res = holdSlot(slot);
    if (!res.ok) {
      setHoldError('That slot is currently held by another citizen. Please select an alternate time.');
      return;
    }
    setSelected(slot);
    setExpiresAt(res.expiresAt);
    setNow(nowMs());
  };

  const pay = async () => {
    if (!selected || !advocate) return;
    setPaying(true);
    setPayError('');
    try {
      const { paymentId } = await mockCheckout(advocate.feeMin);
      const booking = await createBooking({
        advocateId: advocate.id,
        caseId: 'case_2041',
        slot: selected,
        mode,
        amount: advocate.feeMin,
      });
      const { status } = await confirmPayment(booking.id, paymentId);
      releaseHold(selected.id);
      setPayOpen(false);
      router.push(
        dh(`/booking/confirmation/${booking.id}`) +
          '?' +
          new URLSearchParams({ booking: JSON.stringify({ ...booking, status, paymentId }) })
      );
    } catch {
      setPayError('Payment confirmation failed. No amount was charged. Please retry.');
    } finally {
      setPaying(false);
    }
  };

  if (!advocate) {
    return <p className="text-[#5b4a3b]">Advocate dossier not found.</p>;
  }

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="RESERVE CONSULTATION"
        title={`Adv. ${advocate.name}`}
        subtitle={`${advocate.practiceAreas.join(' · ')} · ${advocate.city}`}
        backTo={dh(`/advocates/${advocate.id}`)}
        actions={<Badge tone="mint"><BadgeCheck className="size-3" /> Bar Council Verified</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Mode */}
          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Step 1</p>
            <h2 className="mt-1 font-serif text-[18px] font-normal text-[#2a1c12]">Select Consultation Channel</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {modes.map((m) => {
                const available = advocate.modes.includes(m.key);
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={!available}
                    onClick={() => { setMode(m.key); setSelected(null); setExpiresAt(null); setLoading(true); }}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-[2px] border p-4 text-left transition-colors',
                      active ? 'border-[#2a1c12] bg-[#f4efe6] ring-1 ring-[#2a1c12]' : 'border-[#e2d5c1] bg-[#fffaf2] hover:border-[#9a6a35]',
                      !available && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <m.icon className={cn('size-5', active ? 'text-[#9a6a35]' : 'text-[#85725f]')} aria-hidden />
                    <div>
                      <span className="block text-[13px] font-medium text-[#2a1c12]">{m.label}</span>
                      <span className="block text-[11px] text-[#5b4a3b]">{m.note}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Slots */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Step 2</p>
                <h2 className="mt-1 font-serif text-[18px] font-normal text-[#2a1c12]">Select Available Docket Slot</h2>
                <p className="mt-0.5 text-[12px] text-[#5b4a3b]">Held slots lock for 10 minutes to prevent double-booking across advocates.</p>
              </div>
              {holdActive && (
                <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#b97a29]/30 bg-[#fdf5eb] px-3 py-1 font-mono text-[11px] font-medium text-[#8a5b1c]">
                  <Clock className="size-3.5" aria-hidden /> Reserved {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
                </span>
              )}
            </div>

            {holdError && <p className="mt-3 rounded-[2px] border border-[#9a3424]/30 bg-[#fbf2ef] px-4 py-2.5 text-[12px] text-[#7a2517]">{holdError}</p>}

            {loading ? (
              <div className="flex items-center gap-2.5 py-10 text-[13px] text-[#85725f]">
                <Loader2 className="size-4 animate-spin text-[#9a6a35]" aria-hidden /> Interrogating advocate calendar…
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {byDate.map(([date, daySlots]) => (
                  <div key={date}>
                    <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#85725f]">
                      {formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {daySlots.map((s) => {
                        const active = selected?.id === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => choose(s)}
                            className={cn(
                              'h-10 min-w-[80px] rounded-[2px] border px-3 font-mono text-[12px] font-medium transition-colors',
                              active
                                ? 'border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]'
                                : 'border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:border-[#9a6a35]',
                            )}
                          >
                            {s.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-4 py-3.5">
            <Lock className="size-4 shrink-0 text-[#9a6a35]" aria-hidden />
            <p className="text-[12px] leading-relaxed text-[#5b4a3b]">
              Double booking is prevented by an atomic database constraint. All checkout sessions operate in the sandbox during this stage.
            </p>
          </div>
        </div>

        {/* Summary */}
        <aside className="space-y-6">
          <Card className="p-6 lg:sticky lg:top-20">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Ledger</p>
            <h2 className="mt-1 font-serif text-[18px] font-normal text-[#2a1c12]">Consultation Summary</h2>
            <div className="mt-4 space-y-3 text-[12.5px]">
              <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-2">
                <span className="text-[#85725f]">Advocate</span>
                <span className="font-medium text-[#2a1c12]">Adv. {advocate.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-2">
                <span className="text-[#85725f]">Channel</span>
                <span className="font-medium capitalize text-[#2a1c12]">{mode.replace('-', ' ')}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-2">
                <span className="text-[#85725f]">Reserved Slot</span>
                <span className="font-mono font-medium text-[#2a1c12]">
                  {selected ? `${formatDate(selected.date, { day: 'numeric', month: 'short' })} · ${selected.time}` : 'Not selected'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-2">
                <span className="text-[#85725f]">Allotted Duration</span>
                <span className="font-medium text-[#2a1c12]">30 minutes</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#85725f]">Advocate Fee</span>
                <span className="font-serif text-[16px] font-normal text-[#2a1c12]">{formatInr(advocate.feeMin)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#85725f]">Infrastructure Charge</span>
                <span className="font-mono text-[12px] font-medium text-[#2a1c12]">{formatInr(49)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2a6b3b]">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Non-commission platform fee. Direct payment to advocate.
              </p>
            </div>

            <Button fullWidth className="mt-5" disabled={!holdActive} onClick={() => setPayOpen(true)}>
              <CreditCard className="size-4" aria-hidden /> Confirm & Authorize {formatInr(advocate.feeMin + 49)}
            </Button>
            <p className="mt-2.5 text-center font-mono text-[10px] text-[#85725f]">
              {holdActive ? 'Slot held in escrow. Authorize to seal reservation.' : 'Select a calendar slot to proceed.'}
            </p>
          </Card>

          <Disclaimer variant="banner" text="A consultation constitutes a direct professional relationship between citizen and advocate. NyayaSetu provides matching infrastructure only." />
        </aside>
      </div>

      {/* Mock checkout */}
      <Modal
        open={payOpen}
        onClose={() => !paying && setPayOpen(false)}
        title="Payment Gateway (Sandbox Authorization)"
        description="Statutory testing environment. No live bank credentials or UPI pins are processed."
        footer={
          <>
            <Button variant="secondary" disabled={paying} onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button loading={paying} onClick={pay}>
              {paying ? 'Authorizing…' : `Authorize ${formatInr(advocate.feeMin + 49)}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#9a6a35]">
                  <CreditCard className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-serif text-[14px] font-normal text-[#2a1c12]">Adv. {advocate.name}</p>
                  <p className="font-mono text-[11px] text-[#85725f]">{mode} · 30 min docket</p>
                </div>
              </div>
              <p className="font-serif text-[18px] font-normal text-[#2a1c12]">{formatInr(advocate.feeMin + 49)}</p>
            </div>
          </div>
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-4 text-[12px] leading-relaxed text-[#5b4a3b]">
            <p className="flex items-center gap-1.5 font-medium text-[#2a1c12]">
              <Check className="size-3.5 text-[#2a6b3b]" aria-hidden /> Post-authorization protocol
            </p>
            <p className="mt-1">A cryptographic webhook seals the appointment. A signed calendar file is generated and your preliminary case dossier is transmitted under strict DPDP consent.</p>
          </div>
          {payError && <p className="rounded-[2px] border border-[#9a3424]/30 bg-[#fbf2ef] px-3.5 py-2 text-[12px] text-[#7a2517]">{payError}</p>}
        </div>
      </Modal>
    </div>
  );
}
