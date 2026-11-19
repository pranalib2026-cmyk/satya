import * as React from "react";
import { ShieldAlert, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "warning" | "alert" | "success" | "compliance";

export interface NoticeBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: NoticeVariant;
  title?: string;
  icon?: React.ReactNode;
}

export function NoticeBanner({
  variant = "info",
  title,
  icon,
  children,
  className,
  ...props
}: NoticeBannerProps) {
  const variantStyles: Record<NoticeVariant, { container: string; iconColor: string; defaultIcon: React.ReactNode }> = {
    info: {
      container: "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b]",
      iconColor: "text-[#9a6a35]",
      defaultIcon: <Info className="h-4 w-4 shrink-0" />,
    },
    compliance: {
      container: "border-[#9a6a35]/40 bg-[#fffaf2] text-[#5b4a3b]",
      iconColor: "text-[#9a6a35]",
      defaultIcon: <ShieldAlert className="h-4 w-4 shrink-0" />,
    },
    warning: {
      container: "border-[#e2d5c1] bg-[#fff8e7] text-[#7a4100]",
      iconColor: "text-[#b54708]",
      defaultIcon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    },
    alert: {
      container: "border-[#c0392b]/30 bg-[#fdf2f0] text-[#78261f]",
      iconColor: "text-[#c0392b]",
      defaultIcon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    },
    success: {
      container: "border-[#e2d5c1] bg-[#dceada]/50 text-[#1e5623]",
      iconColor: "text-[#2e7d32]",
      defaultIcon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    },
  };

  const current = variantStyles[variant];

  return (
    <div
      role="region"
      className={cn(
        "rounded-[2px] border p-4 sm:p-4.5 text-xs sm:text-[13px] leading-relaxed transition-all flex items-start gap-3",
        current.container,
        className
      )}
      {...props}
    >
      <span className={cn("mt-0.5 shrink-0", current.iconColor)}>
        {icon || current.defaultIcon}
      </span>
      <div className="space-y-0.5 flex-1">
        {title && (
          <p className="font-semibold text-[#2a1c12] text-xs uppercase tracking-[0.08em] mb-1 font-sans">
            {title}
          </p>
        )}
        <div className="text-current leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
