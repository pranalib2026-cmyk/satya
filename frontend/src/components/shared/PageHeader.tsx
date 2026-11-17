import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  eyebrow,
  className = "",
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between ${className}`}>
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
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-brand uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] leading-[1.15] font-extrabold sm:text-[32px] font-serif text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[14.5px] leading-6 text-body">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
