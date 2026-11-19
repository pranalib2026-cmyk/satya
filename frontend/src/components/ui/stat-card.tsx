import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  unit?: string;
  label: string;
  description?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: "boxed" | "minimal";
}

export function StatCard({
  value,
  unit,
  label,
  description,
  trend,
  variant = "boxed",
  className,
  ...props
}: StatCardProps) {
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "border-l-2 border-[#9a6a35] pl-4 sm:pl-5 py-1 space-y-1.5",
          className
        )}
        {...props}
      >
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-[32px] sm:text-[38px] font-normal text-[#2a1c12] leading-none tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-sans uppercase tracking-[0.08em] text-[#85725f]">
              {unit}
            </span>
          )}
        </div>
        <p className="text-xs font-sans uppercase tracking-[0.14em] font-medium text-[#85725f]">
          {label}
        </p>
        {description && (
          <p className="text-xs text-[#5b4a3b] leading-relaxed pt-0.5">
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 sm:p-6 transition-all duration-200 hover:border-[#cfbe9e] flex flex-col justify-between",
        className
      )}
      {...props}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-sans uppercase tracking-[0.14em] font-medium text-[#85725f]">
            {label}
          </span>
          {trend && (
            <span
              className={cn(
                "text-[11px] font-mono px-2 py-0.5 rounded-[2px] border",
                trend.isPositive
                  ? "border-[#e2d5c1] bg-[#dceada]/60 text-[#2e7d32]"
                  : "border-[#e2d5c1] bg-[#fff8e7] text-[#b54708]"
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        <div className="border-l-2 border-[#9a6a35] pl-3.5 py-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-[32px] sm:text-[36px] font-normal text-[#2a1c12] leading-none tracking-tight">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-sans text-[#85725f] font-medium">
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {description && (
        <p className="mt-3.5 pt-3 border-t border-[#e2d5c1]/60 text-xs text-[#5b4a3b] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
