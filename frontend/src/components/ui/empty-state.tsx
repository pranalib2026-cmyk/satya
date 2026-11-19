import * as React from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[2px] border border-dashed border-[#e2d5c1] bg-[#fffaf2]/60 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-4 grid size-12 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
        {icon || <Scale className="size-6 stroke-[1.6]" aria-hidden="true" />}
      </div>
      <h3 className="font-serif text-[20px] sm:text-[22px] font-normal tracking-tight text-[#2a1c12]">
        {title}
      </h3>
      {body && (
        <p className="mt-1.5 max-w-md text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
