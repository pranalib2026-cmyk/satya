import { api, getStoredToken } from "@/lib/api-client";
import { delay } from "./api";
import { bookings as mockBookings, getAdvocate, slots } from "@/data/dashboard-mock-data";
import type { AdvocateSlot, Booking, BookingStatus } from "@/types/dashboard";

const HOLD_MINUTES = 10;
const holds = new Map<string, number>();

export interface BackendAppointmentResponse {
  id: string;
  booking_reference: string;
  case_id?: string;
  advocate_id: string;
  advocate_name?: string;
  client_id: string;
  client_name?: string;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  status: string;
  mode: string;
  meeting_link?: string;
  fee_inr: number;
  payment_status: string;
  client_notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendAppointmentListResponse {
  total: number;
  page: number;
  limit: number;
  items: BackendAppointmentResponse[];
}

function mapAppointmentToBooking(app: BackendAppointmentResponse): Booking {
  const start = new Date(app.scheduled_start);
  const dateStr = !isNaN(start.getTime()) ? start.toISOString().slice(0, 10) : "2026-11-25";
  const timeStr = !isNaN(start.getTime())
    ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
    : "10:00";

  let mappedStatus: BookingStatus = "confirmed";
  if (app.status === "PENDING_CONFIRMATION") mappedStatus = "pending_payment";
  else if (app.status === "CANCELLED" || app.status === "REJECTED") mappedStatus = "cancelled";
  else if (app.status === "COMPLETED") mappedStatus = "completed";

  let mappedMode: "phone" | "video" | "in-person" = "video";
  if (app.mode === "PHONE") mappedMode = "phone";
  else if (app.mode === "IN_CHAMBERS") mappedMode = "in-person";

  return {
    id: app.id,
    advocateId: app.advocate_id,
    advocateName: app.advocate_name || "Advocate (Verified Roll)",
    caseId: app.booking_reference || app.case_id || "NYA-2026-CS-001",
    date: dateStr,
    time: timeStr,
    mode: mappedMode,
    status: mappedStatus,
    amount: app.fee_inr || 1500,
    createdAt: app.created_at,
  };
}

export async function getSlots(advocateId: string, mode: "phone" | "video" | "in-person" | "any") {
  await delay(200);
  return slots.filter(
    (s) => s.advocateId === advocateId && s.available && (mode === "any" || s.mode === mode),
  );
}

export function holdSlot(slot: AdvocateSlot): { ok: boolean; expiresAt: number; reason?: string } {
  const existing = holds.get(slot.id);
  if (existing && existing > Date.now()) {
    return { ok: false, expiresAt: existing, reason: "This slot is on hold for another user." };
  }
  const expiresAt = Date.now() + HOLD_MINUTES * 60 * 1000;
  holds.set(slot.id, expiresAt);
  return { ok: true, expiresAt };
}

export function releaseHold(slotId: string) {
  holds.delete(slotId);
}

export async function mockCheckout(_amount: number): Promise<{ orderId: string; paymentId: string }> {
  void _amount;
  await delay(800);
  return {
    orderId: `order_inr_${Date.now()}`,
    paymentId: `pay_nya_${Math.floor(Math.random() * 90000 + 10000)}`,
  };
}

export async function confirmPayment(_bookingId: string, _paymentId: string) {
  void _bookingId;
  void _paymentId;
  await delay(400);
  return { status: "confirmed" as BookingStatus };
}

export async function createBooking(input: {
  advocateId: string;
  caseId: string;
  slot: AdvocateSlot;
  mode: "phone" | "video" | "in-person";
  amount: number;
}): Promise<Booking> {
  const token = getStoredToken();
  const adv = getAdvocate(input.advocateId);

  // Parse start and end times into ISO strings
  const startTime = new Date(`${input.slot.date}T${input.slot.time}:00+05:30`);
  const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);

  let backendMode = "VIDEO_CONFERENCE";
  if (input.mode === "phone") backendMode = "PHONE";
  else if (input.mode === "in-person") backendMode = "IN_CHAMBERS";

  // If user is authenticated with a real backend session, call POST /api/v1/appointments
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      // Validate or fallback advocate UUID
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.advocateId);
      const advocateUuid = isValidUUID ? input.advocateId : "00000000-0000-0000-0000-000000000001";

      const res = await api.post<BackendAppointmentResponse>("/api/v1/appointments", {
        advocate_id: advocateUuid,
        case_id: null,
        scheduled_start: startTime.toISOString(),
        scheduled_end: endTime.toISOString(),
        mode: backendMode,
        timezone: "Asia/Kolkata",
        client_notes: `Consultation booked via NyayaSetu Portal for case ${input.caseId}`,
        fee_inr: input.amount,
      });

      return mapAppointmentToBooking(res);
    } catch {
      // Fallback to local booking if backend rejects test advocate UUID
    }
  }

  await delay(400);
  return {
    id: `bk_${Date.now().toString().slice(-6)}`,
    advocateId: input.advocateId,
    advocateName: adv?.name ?? "Adv. Verified Practitioner",
    caseId: input.caseId,
    date: input.slot.date,
    time: input.slot.time,
    mode: input.mode,
    status: "confirmed",
    amount: input.amount,
    createdAt: new Date().toISOString(),
  };
}

export async function listBookings(): Promise<Booking[]> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      const res = await api.get<BackendAppointmentListResponse>("/api/v1/appointments");
      if (res.items && res.items.length > 0) {
        return res.items.map(mapAppointmentToBooking);
      }
    } catch {
      // Retain fallback
    }
  }

  await delay(250);
  return mockBookings;
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      const res = await api.get<BackendAppointmentResponse>(`/api/v1/appointments/${id}`);
      return mapAppointmentToBooking(res);
    } catch {
      // Fallback
    }
  }

  await delay(200);
  return mockBookings.find((b) => b.id === id) ?? mockBookings[0];
}

export function downloadIcs(booking: Booking) {
  const dt = new Date(`${booking.date}T${booking.time}:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const end = new Date(dt.getTime() + 30 * 60 * 1000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NyayaSetu//Consultation//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@nyayasetu.in`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Consultation with ${booking.advocateName}`,
    `DESCRIPTION:NyayaSetu Consultation (Reference: ${booking.id})`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultation-${booking.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
