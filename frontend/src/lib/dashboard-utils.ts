/** Formatting helpers used by the Citizen Dashboard (ported from Legal-1). */

export function formatDate(
  date: string | Date,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(
    "en-IN",
    opts ?? { day: "numeric", month: "short", year: "numeric" }
  );
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Deterministic fallback; callers pass the clock installed after mount. */
const DASHBOARD_EPOCH = new Date("2000-01-01T00:00:00.000Z");

export function relativeDay(date: string, today: Date = DASHBOARD_EPOCH): string {
  const target = new Date(date);
  const reference = new Date(today);
  target.setHours(0, 0, 0, 0);
  reference.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - reference.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
  return formatDate(target, { day: "numeric", month: "short" });
}

export function daysUntil(date: string, today: Date = DASHBOARD_EPOCH): number {
  const target = new Date(date);
  const reference = new Date(today);
  target.setHours(0, 0, 0, 0);
  reference.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - reference.getTime()) / 86_400_000);
}

export function toDateInput(date: string): string {
  return date.slice(0, 10);
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Single time source for handlers/effects (reading the clock during render is impure). */
export function nowMs(): number {
  return Date.now();
}

/** Simulated async boundary, mirroring the reference's services/api.ts delay. */
export function delay(ms = 450): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Maps a reference-app route (top-level, e.g. `/cases`) onto this app's
 * dashboard namespace (`/dashboard/cases`). Idempotent for already-prefixed
 * paths so the same helper works for links declared in either style.
 */
export function dh(path: string): string {
  if (!path.startsWith("/")) return `/dashboard/${path}`;
  if (path === "/" || path === "/dashboard") return "/dashboard";
  if (path.startsWith("/dashboard")) return path;
  return `/dashboard${path}`;
}
