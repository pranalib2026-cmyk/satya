"use client";

import * as React from "react";
import { notifications as seedNotifications } from "@/data/dashboard-mock-data";
import type { NotificationItem } from "@/types/dashboard";

interface DashboardUIState {
  notifications: NotificationItem[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  pushNotification: (
    notification: Omit<NotificationItem, "id" | "at" | "read">
  ) => void;
}

const DashboardUIContext = React.createContext<DashboardUIState | null>(null);

/**
 * Lightweight replacement for the reference app's Zustand `uiStore`.
 * Scoped to the dashboard subtree so the public site is unaffected.
 */
export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] =
    React.useState<NotificationItem[]>(seedNotifications);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const markAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const pushNotification = React.useCallback(
    (notification: Omit<NotificationItem, "id" | "at" | "read">) => {
      setNotifications((prev) => [
        {
          ...notification,
          id: `nt_${Date.now()}`,
          at: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ]);
    },
    []
  );

  const value = React.useMemo<DashboardUIState>(
    () => ({
      notifications,
      sidebarOpen,
      setSidebarOpen,
      markAllRead,
      markRead,
      pushNotification,
    }),
    [notifications, sidebarOpen, markAllRead, markRead, pushNotification]
  );

  return (
    <DashboardUIContext.Provider value={value}>
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI(): DashboardUIState {
  const ctx = React.useContext(DashboardUIContext);
  if (!ctx) {
    throw new Error("useDashboardUI must be used within a DashboardUIProvider");
  }
  return ctx;
}
