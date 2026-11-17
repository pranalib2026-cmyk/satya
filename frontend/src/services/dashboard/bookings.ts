import { delay } from './api'
import { bookings, getAdvocate, slots } from '@/data/dashboard-mock-data'
import type { AdvocateSlot, Booking, BookingStatus } from '@/types/dashboard'

const HOLD_MINUTES = 10

/** In-memory slot holds. TODO: backend stores `held_until` on advocate_slots with a unique constraint. */
const holds = new Map<string, number>()

export async function getSlots(advocateId: string, mode: 'phone' | 'video' | 'in-person' | 'any') {
  await delay(400)
  return slots.filter(
    (s) => s.advocateId === advocateId && s.available && (mode === 'any' || s.mode === mode),
  )
}

export function holdSlot(slot: AdvocateSlot): { ok: boolean; expiresAt: number; reason?: string } {
  const existing = holds.get(slot.id)
  if (existing && existing > Date.now()) {
    return { ok: false, expiresAt: existing, reason: 'This slot is on hold for another user.' }
  }
  const expiresAt = Date.now() + HOLD_MINUTES * 60 * 1000
  holds.set(slot.id, expiresAt)
  return { ok: true, expiresAt }
}

export function releaseHold(slotId: string) {
  holds.delete(slotId)
}

/**
 * Mock Razorpay checkout.
 * TODO: create a real order server-side, open Razorpay checkout, verify signature.
 */
export async function mockCheckout(amount: number): Promise<{ orderId: string; paymentId: string }> {
  await delay(1500)
  console.info('[mock-razorpay] order created', { amount, currency: 'INR' })
  return { orderId: `order_mock_${Date.now()}`, paymentId: `pay_mock_${Math.floor(Math.random() * 90000 + 10000)}` }
}

/**
 * Mock webhook handler. In production Razorpay calls POST /bookings/webhook.
 * The webhook is the only place that moves a booking to `confirmed`.
 */
export async function confirmPayment(bookingId: string, paymentId: string) {
  await delay(600)
  console.info('[mock-webhook] payment.captured', { bookingId, paymentId })
  return { status: 'confirmed' as BookingStatus }
}

export async function createBooking(input: {
  advocateId: string
  caseId: string
  slot: AdvocateSlot
  mode: 'phone' | 'video' | 'in-person'
  amount: number
}): Promise<Booking> {
  await delay(700)
  const adv = getAdvocate(input.advocateId)
  return {
    id: `bk_${Date.now().toString().slice(-6)}`,
    advocateId: input.advocateId,
    advocateName: adv?.name ?? 'Advocate',
    caseId: input.caseId,
    date: input.slot.date,
    time: input.slot.time,
    mode: input.mode,
    status: 'pending_payment',
    amount: input.amount,
    createdAt: new Date().toISOString(),
  }
}

export async function listBookings(): Promise<Booking[]> {
  await delay(350)
  return bookings
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  await delay(250)
  return bookings.find((b) => b.id === id) ?? bookings[0]
}

/** Builds an .ics calendar entry and triggers a download. */
export function downloadIcs(booking: Booking) {
  const dt = new Date(`${booking.date}T${booking.time}:00`)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  const end = new Date(dt.getTime() + 30 * 60 * 1000)

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Legal//Consultation//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@legal.in`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Consultation with Adv. ${booking.advocateName}`,
    `DESCRIPTION:${booking.mode} consultation booked through Legal. Reference ${booking.id}.`,
    'LOCATION:Legal platform',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `legal-consultation-${booking.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
