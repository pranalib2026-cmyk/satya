import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "pb-6 sm:pb-8 border-b border-[#e2d5c1] flex flex-col md:flex-row md:items-end justify-between gap-6",
        className
      )}
    >
      <div className="space-y-2.5 max-w-3xl">
        {/* Breadcrumb Trail */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-[#85725f] font-sans">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-[#cfbe9e] shrink-0" />}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[#2a1c12] transition-colors uppercase tracking-[0.1em]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast ? "text-[#2a1c12] font-medium" : "", "uppercase tracking-[0.1em]")}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Optional Eyebrow Stamp */}
        {eyebrow && (
          <div>
            <Badge variant="stamp">{eyebrow}</Badge>
          </div>
        )}

        {/* Main Editorial Gambetta Title */}
        <h1 className="font-serif text-[32px] sm:text-[40px] lg:text-[46px] font-normal leading-[1.05] tracking-[-0.035em] text-[#2a1c12]">
          {title}
        </h1>

        {/* Subtitle / Contextual summary */}
        {subtitle && (
          <p className="text-[14.5px] sm:text-[15.5px] text-[#5b4a3b] leading-[1.6]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action CTA Slot */}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0 md:self-end">
          {actions}
        </div>
      )}
    </div>
  );
}
