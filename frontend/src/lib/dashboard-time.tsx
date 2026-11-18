"use client";

import { startTransition, useEffect, useState } from "react";
import { MOCK_NOW_ISO } from "@/data/dashboard-mock-data";

/**
 * First-render clock. Dashboard mock records are generated relative to this
 * instant, so the placeholder keeps SSR and hydration byte-identical while
 * still producing meaningful "Today" / "Tomorrow" labels.
 */
export const DASHBOARD_TODAY_PLACEHOLDER = new Date(MOCK_NOW_ISO);

/**
 * Next.js 16 prerenders Client Components, so reading the wall clock during
 * render is rejected. The deterministic placeholder is used for SSR and the
 * first client render; real time is installed in an effect after mount.
 */
export function useDashboardToday(): Date {
  const [today, setToday] = useState<Date>(DASHBOARD_TODAY_PLACEHOLDER);

  useEffect(() => {
    startTransition(() => setToday(new Date()));
  }, []);

  return today;
}
