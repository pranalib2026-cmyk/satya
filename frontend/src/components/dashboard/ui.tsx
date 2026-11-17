"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "mint" | "dark";
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
    "bg-brand text-card-bg shadow-[0_1px_2px_rgb(42_28_18_/_0.08)] hover:bg-brand-dark active:translate-y-px",
  secondary: "bg-brand-soft text-brand-dark hover:bg-secondary-bg active:translate-y-px",
  ghost: "text-ink hover:bg-brand-tint active:translate-y-px",
  danger: "bg-danger text-card-bg hover:bg-brand-dark active:translate-y-px",
  mint: "bg-mint text-dot hover:bg-mint/80 active:translate-y-px",
  dark: "bg-ink text-card-bg hover:bg-brand active:translate-y-px",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
  md: "h-11 px-4.5 text-sm rounded-xl gap-2",
  lg: "h-12.5 px-6 text-[15px] rounded-xl gap-2",
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
          "inline-flex cursor-pointer items-center justify-center font-semibold transition-colors duration-150 select-none",
          "disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
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
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / Dot                                                                */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "brand" | "mint" | "warn" | "danger" | "dark" | "outline";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-secondary-bg text-body",
  brand: "bg-brand-soft text-brand-dark",
  mint: "bg-mint text-dot",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  dark: "bg-ink text-card-bg",
  outline: "border border-line bg-card-bg text-body",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("pill", badgeTones[tone], className)} {...props} />;
}

export function Dot({
  className,
  tone = "dot",
}: {
  className?: string;
  tone?: "dot" | "warn" | "danger";
}) {
  const color = tone === "dot" ? "bg-dot" : tone === "warn" ? "bg-warn" : "bg-danger";
  return <span className={cn("inline-block size-1.5 rounded-full", color, className)} aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("field h-11", className)} {...props} />;
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("field min-h-24 resize-y", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("field h-11 appearance-none bg-card-bg pr-9", className)} {...props}>
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
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
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
        "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition hover:border-brand/40 hover:bg-brand-tint/60",
        className
      )}
    >
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-line accent-brand" {...props} />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-5 text-body">{description}</span>}
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
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
        checked ? "bg-brand" : "bg-border-hover"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-card-bg shadow transition-all",
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

/** Only the most recently opened dialog reacts to Escape / traps Tab. */
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
    <div className="fixed inset-0 z-70 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-t-3xl bg-card-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop animate-in-up focus:outline-none sm:rounded-3xl sm:p-6",
          width
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-body">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-body hover:bg-brand-tint"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
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
    <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-xl bg-secondary-bg p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg font-semibold transition",
            size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-3.5 text-[13px]",
            value === opt.value ? "bg-card-bg text-ink shadow-sm" : "text-body hover:text-ink"
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                value === opt.value ? "bg-brand-soft text-brand-dark" : "bg-card-bg/70 text-muted"
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
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition",
        active
          ? "border-brand bg-brand-soft text-brand-dark"
          : "border-line bg-card-bg text-body hover:border-brand/40 hover:text-ink",
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
    brand: "bg-brand-soft text-brand-dark",
    mint: "bg-mint text-dot",
    neutral: "bg-secondary-bg text-ink",
  };
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full font-bold",
        dims[size],
        tones[tone],
        className
      )}
    >
      {initials}
      {online && (
        <span
          className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card-bg bg-dot"
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
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary-bg", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
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
            "h-1.5 rounded-full transition-all",
            i === current ? "w-6 bg-brand" : i < current ? "w-1.5 bg-dot" : "w-1.5 bg-border-hover"
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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center",
        className
      )}
    >
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>}
      <h3 className="text-[15px] font-bold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-6 text-body">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary-bg", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-5">
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
      <div className="h-3 w-28 animate-pulse rounded-full bg-secondary-bg" />
      <div className="h-8 w-2/3 max-w-md animate-pulse rounded-xl bg-secondary-bg" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded-lg bg-brand-tint" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-16" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
