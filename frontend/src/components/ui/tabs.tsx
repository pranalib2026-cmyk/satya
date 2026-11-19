"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id?: string;
  value?: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs?: TabItem[];
  options?: TabItem[]; // dashboard compatibility
  activeTab?: string;
  value?: string; // dashboard compatibility
  onChange: (id: string) => void;
  className?: string;
  variant?: "pill" | "underline" | "chip";
  size?: "sm" | "md";
}

export function Tabs({
  tabs,
  options,
  activeTab,
  value,
  onChange,
  className,
  variant = "pill",
  size = "md",
}: TabsProps) {
  const items = options || tabs || [];
  const current = value ?? activeTab ?? (items[0]?.id || items[0]?.value || "");

  if (variant === "underline") {
    return (
      <div className={cn("flex space-x-6 border-b border-[#e2d5c1] overflow-x-auto hide-scrollbar", className)}>
        {items.map((tab) => {
          const key = tab.value ?? tab.id ?? "";
          const isActive = key === current;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              className={cn(
                "pb-3.5 text-sm font-sans tracking-wide transition-all border-b-2 cursor-pointer whitespace-nowrap",
                isActive
                  ? "border-[#2a1c12] text-[#2a1c12] font-semibold"
                  : "border-transparent text-[#85725f] hover:text-[#2a1c12]"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-2 text-xs opacity-60">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 border border-[#e2d5c1] bg-[#ebe1d1]/50 p-1 rounded-[2px]",
        className
      )}
    >
      {items.map((tab) => {
        const key = tab.value ?? tab.id ?? "";
        const isActive = key === current;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={cn(
              "font-sans uppercase tracking-[0.12em] font-medium transition-all cursor-pointer rounded-[2px] flex items-center gap-1.5",
              size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs",
              isActive
                ? "bg-[#2a1c12] text-[#fffaf2] shadow-xs"
                : "text-[#5b4a3b] hover:text-[#2a1c12] hover:bg-[#fffaf2]/60"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-none text-[10px] font-mono",
                  isActive ? "bg-[#d1a46a] text-[#2a1c12] font-semibold" : "bg-[#e2d5c1] text-[#5b4a3b]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border px-3 text-xs uppercase tracking-[0.08em] font-medium transition-colors",
        active
          ? "border-[#9a6a35] bg-[#fffaf2] text-[#9a6a35] font-semibold"
          : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#9a6a35]/60 hover:text-[#2a1c12]",
        className
      )}
    >
      {children}
    </button>
  );
}
