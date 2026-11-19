import * as React from "react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "size-4 border-2",
    md: "size-6 border-2",
    lg: "size-8 border-[2.5px]",
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-[#9a6a35] border-t-transparent inline-block",
        sizeMap[size],
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[2px] bg-[#ebe1d1]/70",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 space-y-3",
        className
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="space-y-6 py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading page contents…</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
