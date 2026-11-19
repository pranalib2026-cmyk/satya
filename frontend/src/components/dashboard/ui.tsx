"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "compound" | "secondary" | "outline" | "ghost" | "danger" | "mint" | "dark";
type ButtonSize = "sm" | "md" | "lg";

export interface DashboardButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] hover:border-[#9a6a35] active:bg-[#7c5226]",
  compound:
    "border border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] hover:border-[#9a6a35] active:bg-[#7c5226]",
  secondary:
    "border border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12] hover:bg-[#e2d5c1] hover:border-[#cfbe9e] active:bg-[#cfbe9e]",
  outline:
    "border-[1.5px] border-[#2a1c12] bg-transparent text-[#2a1c12] hover:bg-[#2a1c12] hover:text-[#fffaf2]",
  ghost:
    "border border-transparent bg-transparent text-[#5b4a3b] hover:text-[#2a1c12] hover:bg-[#ebe1d1]/50",
  danger:
    "border border-[#c0392b] bg-[#c0392b] text-[#fffaf2] hover:bg-[#a93226]",
  mint:
    "border border-[#e2d5c1] bg-[#dceada]/70 text-[#2e7d32] hover:bg-[#dceada]",
  dark:
    "border border-[#24180f] bg-[#24180f] text-[#fffaf2] hover:bg-[#9a6a35] hover:border-[#9a6a35]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs rounded-[2px] gap-1.5",
  md: "h-11 px-4.5 text-sm rounded-[2px] gap-2",
  lg: "h-12.5 px-6 text-[15px] rounded-[2px] gap-2",
};

export const Button = React.forwardRef<HTMLButtonElement, DashboardButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, fullWidth, children, disabled, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center font-sans font-medium transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9a6a35] disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 sm:p-6 shadow-[0_1px_2px_rgba(42,28,18,0.04)] transition-all",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-4 border-b border-[#e2d5c1]/60", className)}>
      <div className="min-w-0 space-y-0.5">
        <h2 className="font-serif text-[19px] sm:text-[21px] font-normal tracking-tight text-[#2a1c12]">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[#5b4a3b] leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / Dot                                                                */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "brand" | "mint" | "warn" | "danger" | "dark" | "outline" | "stamp" | "gold" | "sand";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12]",
  brand: "border-[#d1a46a] bg-[#fffaf2] text-[#9a6a35]",
  mint: "border-[#e2d5c1] bg-[#dceada]/60 text-[#2e7d32]",
  warn: "border-[#e2d5c1] bg-[#fff8e7] text-[#b54708]",
  danger: "border-[#c0392b]/30 bg-[#fdf2f0] text-[#c0392b]",
  dark: "border-[#3f2c1f] bg-[#2f2116] text-[#d1a46a]",
  outline: "border-[#e2d5c1] bg-transparent text-[#5b4a3b]",
  stamp: "border border-[#e2d5c1] bg-[#fffaf2]/80 text-[#85725f]",
  gold: "border border-[#d1a46a] bg-[#fffaf2] text-[#9a6a35]",
  sand: "border border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12]",
};

export function Badge({
  tone,
  variant,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; variant?: BadgeTone }) {
  const chosenTone: BadgeTone = (variant ?? tone ?? "neutral") as BadgeTone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium font-sans uppercase tracking-[0.14em] rounded-[2px] border transition-colors select-none",
        badgeTones[chosenTone] || badgeTones.neutral,
        className
      )}
      {...props}
    />
  );
}

export function Dot({
  className,
  tone = "dot",
}: {
  className?: string;
  tone?: "dot" | "warn" | "danger";
}) {
  const color = tone === "dot" ? "bg-[#2e7d32]" : tone === "warn" ? "bg-[#b54708]" : "bg-[#c0392b]";
  return <span className={cn("inline-block size-1.5 rounded-full shrink-0", color, className)} aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2.5 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35] disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2 text-sm text-[#2a1c12] transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35] disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M6%208L10%2012L14%208%22%20stroke%3D%22%2385725f%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat pr-10",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#85725f]">{hint}</p>}
      {error && <p className="text-xs font-medium text-[#c0392b]">{error}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-4 transition-colors hover:border-[#9a6a35]/60 hover:bg-[#ebe1d1]/30",
        className
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded-[2px] border-[#e2d5c1] accent-[#9a6a35] focus:ring-[#9a6a35]"
        {...props}
      />
      <span>
        <span className="block text-sm font-semibold text-[#2a1c12]">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[#5b4a3b]">{description}</span>
        )}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors border border-[#e2d5c1]",
        checked ? "bg-[#9a6a35]" : "bg-[#ebe1d1]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4.5 rounded-full bg-[#fffaf2] shadow-xs transition-all",
          checked ? "left-5.5" : "left-0.5"
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const openDialogs: number[] = [];
let dialogSequence = 0;
let scrollLocks = 0;
let savedBodyOverflow = "";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const mounted = React.useSyncExternalStore(
    subscribeToClient,
    clientSnapshot,
    serverSnapshot
  );
  const dialogIdRef = React.useRef(0);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open || !mounted) return;

    const id = ++dialogSequence;
    dialogIdRef.current = id;
    openDialogs.push(id);

    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusable?.[0] ?? dialog)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null
      );
      if (nodes.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    if (scrollLocks === 0) savedBodyOverflow = document.body.style.overflow;
    scrollLocks += 1;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      const idx = openDialogs.indexOf(id);
      if (idx !== -1) openDialogs.splice(idx, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = savedBodyOverflow;
      previousFocus.current?.focus();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 animate-fade bg-[#24180f]/75 backdrop-blur-xs" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-8 shadow-[0_20px_50px_rgba(36,24,15,0.25)] animate-in-up focus:outline-none my-auto",
          width
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4 pb-3 border-b border-[#e2d5c1]/60">
          <div>
            <h2 id={titleId} className="font-serif text-[22px] sm:text-[24px] font-normal text-[#2a1c12]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs text-[#5b4a3b] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[2px] text-[#85725f] hover:text-[#2a1c12] hover:bg-[#ebe1d1]/50 transition-colors"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto pr-1">{children}</div>
        {footer && (
          <div className="mt-6 pt-4 border-t border-[#e2d5c1] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs / Chip                                                                */
/* -------------------------------------------------------------------------- */

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 border border-[#e2d5c1] bg-[#ebe1d1]/50 p-1 rounded-[2px]",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 font-sans uppercase tracking-[0.12em] font-medium transition rounded-[2px]",
            size === "sm" ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-xs",
            value === opt.value
              ? "bg-[#2a1c12] text-[#fffaf2] shadow-xs"
              : "text-[#5b4a3b] hover:text-[#2a1c12] hover:bg-[#fffaf2]/60"
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-none text-[10px] font-mono",
                value === opt.value ? "bg-[#d1a46a] text-[#2a1c12] font-semibold" : "bg-[#e2d5c1] text-[#5b4a3b]"
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
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

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  initials,
  size = "md",
  tone = "brand",
  online,
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "brand" | "mint" | "neutral";
  online?: boolean;
  className?: string;
}) {
  const dims = {
    sm: "size-8 text-[11px]",
    md: "size-10 text-xs",
    lg: "size-12 text-sm",
    xl: "size-16 text-lg",
  };
  const tones = {
    brand: "border border-[#d1a46a]/60 bg-[#fffaf2] text-[#9a6a35]",
    mint: "border border-[#e2d5c1] bg-[#dceada]/60 text-[#2e7d32]",
    neutral: "border border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12]",
  };
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full font-serif font-medium",
        dims[size],
        tones[tone],
        className
      )}
    >
      {initials}
      {online && (
        <span
          className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[#fffaf2] bg-[#2e7d32]"
          aria-label="Online"
        />
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-[1px] bg-[#ebe1d1]", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full bg-[#9a6a35] transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-[1px] transition-all",
            i === current ? "w-6 bg-[#9a6a35]" : i < current ? "w-2 bg-[#2e7d32]" : "w-1.5 bg-[#e2d5c1]"
          )}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty / Skeleton                                                           */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[2px] border border-dashed border-[#e2d5c1] bg-[#fffaf2]/60 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-3.5 grid size-12 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
        {icon || <Scale className="size-6 stroke-[1.6]" />}
      </div>
      <h3 className="font-serif text-[19px] sm:text-[21px] font-normal text-[#2a1c12] tracking-tight">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-xs sm:text-[13px] leading-relaxed text-[#5b4a3b]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[2px] bg-[#ebe1d1]/70", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] space-y-3 p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div className="h-3 w-28 animate-pulse rounded-[2px] bg-[#ebe1d1]" />
      <div className="h-8 w-2/3 max-w-md animate-pulse rounded-[2px] bg-[#ebe1d1]" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded-[2px] bg-[#ebe1d1]/60" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-16" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
