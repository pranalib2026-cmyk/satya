"use client";

import "./dashboard.css";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  FolderLock,
  Globe,
  Menu,
  MessageSquareText,
  MessagesSquare,
  ScanLine,
  Scale,
  ShieldCheck,
  Siren,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashboardUIProvider, useDashboardUI } from "@/lib/dashboard-ui-context";
import { languageLabels } from "@/data/dashboard-mock-data";
import type { Language } from "@/types/dashboard";
import { dh, formatDateTime } from "@/lib/dashboard-utils";
import { BrandLogo } from "@/components/dashboard/shared";
import { PageLoader } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: string;
}

const groups: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [
      { to: "/dashboard", label: "Home", icon: Scale, end: true },
      { to: "/dashboard/chat", label: "AI legal assistant", icon: Sparkles },
      { to: "/dashboard/cases", label: "My cases", icon: FolderLock },
      { to: "/dashboard/deadlines", label: "Deadlines", icon: CalendarClock, badge: "3" },
      { to: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
      { to: "/dashboard/messages", label: "Messages", icon: MessagesSquare, badge: "3" },
    ],
  },
  {
    title: "Get help",
    items: [
      { to: "/dashboard/advocates", label: "Find an advocate", icon: Scale },
      { to: "/dashboard/self-help", label: "Self-help tools", icon: FileText },
      { to: "/dashboard/vault", label: "Document vault", icon: ShieldCheck },
      { to: "/dashboard/scan", label: "Scan & explain", icon: ScanLine },
    ],
  },
  {
    title: "Account",
    items: [{ to: "/dashboard/profile", label: "Profile & privacy", icon: UserRound }],
  },
];

const mobileTabs: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Scale, end: true },
  { to: "/dashboard/cases", label: "Cases", icon: FolderLock },
  { to: "/dashboard/vault", label: "Documents", icon: ShieldCheck },
  { to: "/dashboard/messages", label: "Messages", icon: MessagesSquare },
  { to: "/dashboard/profile", label: "Profile", icon: UserRound },
];

function useOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

function SidebarItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.to}
      onClick={onNavigate}
      className={cn(
        "group flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold transition",
        active ? "bg-brand-soft text-brand-dark" : "text-body hover:bg-brand-tint hover:text-ink"
      )}
    >
      <Icon
        className={cn(
          "size-[17px] shrink-0",
          active ? "text-brand" : "text-muted group-hover:text-ink"
        )}
        strokeWidth={active ? 2.4 : 2}
        aria-hidden="true"
      />
      <span className="flex-1">{item.label}</span>
      {active && <span className="size-1.5 rounded-full bg-dot" aria-hidden="true" />}
      {item.badge && !active && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary-bg px-1.5 text-[10px] font-bold text-body">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <BrandLogo onClick={onNavigate} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="mb-1.5 px-3 text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-2xl border border-line bg-brand-tint p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
            <MessageSquareText className="size-3.5 text-brand" aria-hidden="true" />
            Free legal aid
          </p>
          <p className="mt-1 text-[11.5px] leading-5 text-body">
            Eligible for free representation? Call the DLSA helpline.
          </p>
          <a
            href="tel:15100"
            className="mt-2.5 inline-flex h-8 w-full items-center justify-center rounded-lg bg-mint text-[12px] font-bold text-dot transition hover:bg-mint/80"
          >
            Call 15100
          </a>
        </div>
        <p className="mt-3 px-1 text-[10.5px] leading-4 text-muted">
          Legal information only. Not legal advice.
        </p>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-card-bg lg:block">
      <SidebarContent />
    </aside>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage } = useAuth();
  const [open, setOpen] = React.useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-card-bg px-2.5 text-[12.5px] font-semibold text-ink transition hover:bg-brand-tint"
      >
        <Globe className="size-4 text-body" aria-hidden="true" />
        <span className="hidden sm:inline">{languageLabels[language]}</span>
        <span className="sm:hidden">{language.toUpperCase()}</span>
        <ChevronDown className={cn("size-3.5 text-muted transition", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-60 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-card-bg p-1 shadow-pop animate-in-up"
        >
          {(Object.keys(languageLabels) as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              role="option"
              aria-selected={language === lang}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-[13px] font-medium transition hover:bg-brand-tint",
                language === lang ? "text-brand-dark" : "text-ink"
              )}
            >
              {languageLabels[lang]}
              {language === lang && <Check className="size-4 text-brand" aria-hidden="true" />}
            </button>
          ))}
          <p className="px-3 pt-1.5 pb-1 text-[10.5px] leading-4 text-muted">
            Navigation, sign-in, home and emergency are translated. Other screens stay in English for now.
          </p>
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { notifications, markAllRead, markRead } = useDashboardUI();
  const [open, setOpen] = React.useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        className="relative grid size-9 cursor-pointer place-items-center rounded-xl border border-line bg-card-bg transition hover:bg-brand-tint"
      >
        <Bell className="size-[17px] text-ink" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full border-2 border-card-bg bg-danger text-[9px] font-bold text-card-bg">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-60 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-line bg-card-bg shadow-pop animate-in-up">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            <button
              type="button"
              onClick={markAllRead}
              className="cursor-pointer text-[12px] font-semibold text-brand hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  markRead(n.id);
                  if (n.href) {
                    router.push(dh(n.href));
                    setOpen(false);
                  }
                }}
                className="flex w-full cursor-pointer gap-3 border-b border-line/70 px-4 py-3 text-left transition last:border-0 hover:bg-brand-tint"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.read ? "bg-border-hover" : "bg-dot"
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink">{n.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-body">{n.body}</span>
                  <span className="mt-1 block text-[10.5px] text-muted">{formatDateTime(n.at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user } = useAuth();
  const [drawer, setDrawer] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-card-bg/90 backdrop-blur-md">
        <div className="flex h-15 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-line lg:hidden"
          >
            <Menu className="size-4.5" aria-hidden="true" />
          </button>

          <div className="lg:hidden">
            <BrandLogo compact />
          </div>

          <div className="hidden flex-1 items-center gap-2 lg:flex">
            <span className="pill bg-mint-soft text-dot">
              <span className="size-1.5 rounded-full bg-dot" aria-hidden="true" />
              Karnataka · India
            </span>
            <span className="text-[12px] text-muted">Legal information, clearly explained</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationBell />
            <Link
              href="/dashboard/profile"
              className="ml-0.5 grid size-9 place-items-center rounded-full bg-brand-soft text-[12px] font-extrabold text-brand-dark transition hover:ring-4 hover:ring-brand/10"
              aria-label="Open profile"
            >
              {user?.name?.slice(0, 1).toUpperCase() ?? "R"}
            </Link>
          </div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-70 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-[320px] bg-card-bg shadow-pop animate-in-up">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full text-body hover:bg-brand-tint"
            >
              <X className="size-4.5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-line px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[11.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-dot align-middle" aria-hidden="true" />
          Legal information only. Not legal advice.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1 pr-16 sm:pr-20 lg:pr-40">
          <Link href="/dashboard/profile" className="hover:text-ink hover:underline">
            Privacy & consent
          </Link>
          <Link href="/dashboard/profile" className="hover:text-ink hover:underline">
            Grievance officer
          </Link>
          <a href="tel:15100" className="hover:text-ink hover:underline">
            Legal aid 15100
          </a>
          <span>© 2026 NyayaSetu</span>
        </nav>
      </div>
    </footer>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { notifications } = useDashboardUI();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab);
          const showBadge = tab.to === "/dashboard/messages" && unread > 0;
          return (
            <Link
              key={tab.to}
              href={tab.to}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition",
                active ? "text-brand-dark" : "text-muted"
              )}
            >
              <span className="relative">
                <Icon
                  className={cn("size-[21px]", active && "text-brand")}
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 size-2 rounded-full bg-dot ring-2 ring-card-bg" />
                )}
              </span>
              <span>{tab.label}</span>
              {active && <span className="absolute bottom-1 size-1 rounded-full bg-dot" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function EmergencyButton() {
  const pathname = usePathname();
  const active = pathname === "/dashboard/emergency";

  return (
    <Link
      href="/dashboard/emergency"
      aria-label="Open emergency help"
      className={cn(
        "fixed right-3 bottom-20 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger text-[13px] font-bold text-card-bg shadow-pop transition",
        "hover:scale-[1.03] hover:bg-brand-dark active:scale-[0.98]",
        "lg:right-6 lg:bottom-6 lg:h-13 lg:w-auto lg:justify-start lg:gap-2 lg:pr-5 lg:pl-3.5",
        active && "opacity-70"
      )}
    >
      <span className="relative grid size-8 place-items-center rounded-full bg-card-bg/15 lg:size-7">
        <Siren className="size-4" aria-hidden="true" />
        <span className="absolute inset-0 animate-ping rounded-full bg-card-bg/20" aria-hidden="true" />
      </span>
      <span className="hidden lg:inline">Emergency</span>
    </Link>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedToken = localStorage.getItem("nyayasetu_token");
    if (!storedToken && !user) router.push("/login");
  }, [user, router]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="dashboard-scope min-h-screen bg-primary-bg">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-[264px]">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <Footer />
      </div>
      <BottomNav />
      <EmergencyButton />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardUIProvider>
      <React.Suspense
        fallback={
          <div className="dashboard-scope min-h-screen bg-primary-bg p-6">
            <div className="mx-auto w-full max-w-6xl">
              <PageLoader />
            </div>
          </div>
        }
      >
        <DashboardShell>{children}</DashboardShell>
      </React.Suspense>
    </DashboardUIProvider>
  );
}
