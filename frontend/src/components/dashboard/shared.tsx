"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ExternalLink,
  Info,
  Languages,
  MapPin,
  Scale,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatInr } from "@/lib/dashboard-utils";
import { spokenLanguageLabels } from "@/data/dashboard-mock-data";
import type { AdvocateMatch, Citation } from "@/types/dashboard";
import { Avatar, Badge, Button, Dot, Modal } from "@/components/dashboard/ui";

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

export function BrandLogo({
  compact = false,
  className,
  onClick,
}: {
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="NyayaSetu — home"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-card-bg shadow-[0_2px_8px_rgb(42_28_18_/_0.28)]">
        <Scale className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[19px] font-extrabold tracking-tight text-ink">NyayaSetu</span>
          <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.16em] text-muted uppercase">न्यायसेतु</span>
        </span>
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                  */
/* -------------------------------------------------------------------------- */

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "mint" | "neutral" | "danger";
  onClick?: () => void;
}) {
  const tones = {
    brand: "bg-brand-soft text-brand-dark",
    mint: "bg-mint text-dot",
    neutral: "bg-secondary-bg text-ink",
    danger: "bg-danger-soft text-danger",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "card flex items-start gap-3.5 p-4 text-left transition sm:p-5",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-pop"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-body">{label}</p>
        <p className="mt-0.5 text-[22px] leading-tight font-extrabold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11.5px] text-muted">{hint}</p>}
      </div>
    </Comp>
  );
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {backTo && (
          <Link
            href={backTo}
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-body transition hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
        )}
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-brand uppercase">{eyebrow}</p>
        )}
        <h1 className="text-[26px] leading-[1.15] font-extrabold sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[14.5px] leading-6 text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Disclaimer + error                                                         */
/* -------------------------------------------------------------------------- */

export function Disclaimer({
  className,
  variant = "inline",
  text = "Legal information only. Not legal advice.",
}: {
  className?: string;
  variant?: "inline" | "banner";
  text?: string;
}) {
  if (variant === "banner") {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-xl border border-line bg-brand-tint px-3.5 py-3", className)}>
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <p className="text-[12.5px] leading-5 text-body">{text}</p>
      </div>
    );
  }
  return (
    <p className={cn("flex items-start gap-1.5 text-[12px] leading-5 text-muted", className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

export function ServiceError({
  title = "Could not load this screen",
  message = "The service did not respond. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("rounded-2xl border border-danger/20 bg-danger-soft px-4 py-4 sm:px-5", className)}
    >
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-danger">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-danger">{message}</p>
          {onRetry && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Advocate card                                                              */
/* -------------------------------------------------------------------------- */

export function AdvocateCard({
  match,
  rank,
  onBook,
}: {
  match: AdvocateMatch;
  rank?: number;
  onBook?: () => void;
}) {
  const { advocate: a, score, reason } = match;
  return (
    <article className="card flex h-full flex-col p-4 transition hover:border-brand/25 hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar initials={a.initials} size="lg" tone={rank === 1 ? "mint" : "brand"} />
          <div className="min-w-0">
            <h3 className="text-[15.5px] leading-snug font-bold">Adv. {a.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-1.5 py-0.5 text-[10px] font-bold text-dot">
                <BadgeCheck className="size-3" aria-hidden="true" /> Verified
              </span>
              {rank === 1 && <Badge tone="brand">Best fit</Badge>}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[18px] leading-none font-extrabold text-brand">{Math.round(score.total * 100)}%</p>
          <p className="mt-1 text-[9.5px] font-semibold tracking-wide text-muted uppercase">match</p>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-body">
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-3.5" aria-hidden="true" /> {a.experienceYears} yrs
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden="true" /> {a.distanceKm} km
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" /> {a.rating} ({a.reviewCount})
        </span>
      </p>

      <p className="mt-2 flex flex-wrap gap-1.5">
        {a.practiceAreas.slice(0, 3).map((area) => (
          <Badge key={area} tone="neutral">
            {area}
          </Badge>
        ))}
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
        <Languages className="size-3.5 shrink-0" aria-hidden="true" />
        {a.languages.map((l) => spokenLanguageLabels[l]).join(", ")}
      </p>

      <div className="mt-3 flex-1 rounded-xl bg-brand-tint px-3 py-2.5">
        <p className="line-clamp-3 text-[11.5px] leading-5 text-body">
          <span className="font-semibold text-ink">Why we suggest this: </span>
          {reason}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold">
            {formatInr(a.feeMin)}–{formatInr(a.feeMax)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted">
            <Dot /> {a.responseRate}% response rate
          </p>
        </div>
        <p className="shrink-0 text-right text-[10.5px] text-muted">
          Next slot
          <span className="block text-[11.5px] font-semibold text-ink">
            {a.nextAvailable ? formatDate(a.nextAvailable, { day: "numeric", month: "short" }) : "Soon"}
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/dashboard/advocates/${a.id}`}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-card-bg px-3 text-[12.5px] font-semibold text-ink transition hover:bg-brand-tint"
        >
          View profile
        </Link>
        <Button size="sm" onClick={onBook} fullWidth>
          Book
        </Button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Citation chip                                                              */
/* -------------------------------------------------------------------------- */

export function CitationChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${citation.act} — ${citation.section}`}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card-bg px-2.5 py-1 text-[11.5px] font-semibold text-brand-dark transition hover:border-brand/40 hover:bg-brand-soft"
      >
        <BookOpen className="size-3" aria-hidden="true" />
        {citation.act.split(",")[0]} · {citation.section}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={citation.act}
        description={citation.section}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => window.open(citation.url, "_blank", "noopener")}>
              View on India Code
              <ExternalLink className="size-4" />
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">{citation.title}</p>
          <blockquote className="rounded-xl border-l-2 border-brand bg-brand-tint px-4 py-3 text-[13.5px] leading-6 text-body">
            {citation.snippet}
          </blockquote>
          <p className="text-xs text-muted">
            Sources are reviewed by advocates. Always check the current version of the Act.
          </p>
        </div>
      </Modal>
    </>
  );
}
