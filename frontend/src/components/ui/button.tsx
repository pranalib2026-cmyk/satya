import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "compound"
    | "secondary"
    | "outline"
    | "ghost"
    | "bronze"
    | "darkOutline"
    | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  fullWidth?: boolean;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      disabled,
      fullWidth,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    // Compound button: signature homepage button with text block and separate right arrow container
    if (variant === "compound") {
      return (
        <button
          ref={ref}
          disabled={disabled || isLoading}
          className={cn(
            "group inline-flex items-center bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] transition-colors rounded-[2px] overflow-hidden shadow-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none border border-transparent",
            fullWidth && "w-full justify-between",
            className
          )}
          {...props}
        >
          <span
            className={cn(
              "font-sans font-semibold tracking-tight",
              size === "sm" && "px-3.5 py-2 text-xs",
              size === "md" && "px-4.5 py-2.5 sm:px-5 sm:py-3 text-[14px]",
              size === "lg" && "px-6 py-3.5 text-base"
            )}
          >
            {isLoading && (
              <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {children}
          </span>
          <span
            className={cn(
              "flex items-center justify-center border-l border-white/20 bg-[#fffaf2]/10 group-hover:bg-[#fffaf2]/20 transition-colors shrink-0",
              size === "sm" && "w-8 py-2",
              size === "md" && "w-9 sm:w-10 py-2.5 sm:py-3",
              size === "lg" && "w-12 py-3.5"
            )}
          >
            {rightIcon || <ArrowRight className="h-4 w-4" />}
          </span>
        </button>
      );
    }

    const baseStyles =
      "inline-flex items-center justify-center font-sans font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9a6a35] disabled:opacity-50 disabled:pointer-events-none cursor-pointer rounded-[2px] border select-none";

    const variantStyles = {
      primary:
        "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] hover:border-[#9a6a35] active:bg-[#7c5226]",
      secondary:
        "border-[#e2d5c1] bg-[#ebe1d1] text-[#2a1c12] hover:bg-[#e2d5c1] hover:border-[#cfbe9e] active:bg-[#cfbe9e]",
      outline:
        "border-[#2a1c12] bg-transparent text-[#2a1c12] hover:bg-[#2a1c12] hover:text-[#fffaf2] active:bg-[#7c5226]",
      bronze:
        "border-[#9a6a35] bg-[#9a6a35] text-[#fffaf2] hover:bg-[#7c5226] hover:border-[#7c5226] active:bg-[#2a1c12]",
      ghost:
        "border-transparent bg-transparent text-[#5b4a3b] hover:text-[#2a1c12] hover:bg-[#ebe1d1]/60",
      darkOutline:
        "border-[#d1a46a]/60 bg-[#2f2116] text-[#f3ece1] hover:bg-[#9a6a35] hover:border-[#9a6a35]",
      danger:
        "border-[#c0392b] bg-[#c0392b] text-[#fffaf2] hover:bg-[#a93226] hover:border-[#a93226]",
    };

    const sizeStyles = {
      sm: "h-9 px-3.5 text-xs uppercase tracking-[0.08em] gap-1.5",
      md: "h-11 px-5 text-sm tracking-normal gap-2",
      lg: "h-13 px-7 text-base tracking-normal gap-2.5",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
        {rightIcon && <span className="ml-1.5 shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
