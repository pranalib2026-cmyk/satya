import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "stamp"
  | "gold"
  | "sand"
  | "dark"
  | "solid"
  | "outline"
  | "status-active"
  | "status-pending"
  | "status-urgent"
  | "status-neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  withDot?: boolean;
}

export function Badge({
  className,
  variant = "stamp",
  withDot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    stamp: "border border-[#e2d5c1] bg-[#fffaf2]/80 text-[#85725f]",
    gold: "border border-[#d1a46a] bg-[#fffaf2] text-[#9a6a35]",
    sand: "border border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12]",
    dark: "border border-[#3f2c1f] bg-[#2f2116] text-[#d1a46a]",
    solid: "border border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]",
    outline: "border border-[#e2d5c1] bg-transparent text-[#5b4a3b]",
    "status-active": "border border-[#e2d5c1] bg-[#dceada]/60 text-[#2e7d32]",
    "status-pending": "border border-[#e2d5c1] bg-[#fff8e7] text-[#b54708]",
    "status-urgent": "border border-[#c0392b]/30 bg-[#fdf2f0] text-[#c0392b]",
    "status-neutral": "border border-[#e2d5c1] bg-[#fffaf2]/90 text-[#85725f]",
  };

  const dotColors: Partial<Record<BadgeVariant, string>> = {
    "status-active": "bg-[#2e7d32]",
    "status-pending": "bg-[#b54708]",
    "status-urgent": "bg-[#c0392b]",
    "status-neutral": "bg-[#85725f]",
    gold: "bg-[#9a6a35]",
    stamp: "bg-[#85725f]",
  };

  const showDot = withDot || variant.startsWith("status-");
  const dotColor = dotColors[variant] || "bg-current";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium font-sans uppercase tracking-[0.14em] rounded-[2px] transition-colors select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn("inline-block size-1.5 rounded-full shrink-0", dotColor)}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
