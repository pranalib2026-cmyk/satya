import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
  href?: string;
  showSubtitle?: boolean;
}

export function Logo({
  size = "md",
  inverted = false,
  href = "/",
  showSubtitle = true,
  className,
  ...props
}: LogoProps) {
  const sizeConfig = {
    sm: {
      svgHeight: "h-5",
      titleSize: "text-[18px]",
      subSize: "text-[9px]",
      spacing: "space-x-2",
    },
    md: {
      svgHeight: "h-6",
      titleSize: "text-[21px]",
      subSize: "text-[10px]",
      spacing: "space-x-3",
    },
    lg: {
      svgHeight: "h-8",
      titleSize: "text-[26px]",
      subSize: "text-[11px]",
      spacing: "space-x-3.5",
    },
  };

  const config = sizeConfig[size];

  const content = (
    <div className={cn("inline-flex items-center group", config.spacing, className)}>
      {/* Canonical Monogram SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-242 -690 975 700"
        className={cn(config.svgHeight, "w-auto shrink-0 transition-transform duration-200 group-hover:scale-105")}
        aria-hidden="true"
      >
        <path
          fill="#9a6a35"
          d="M179.56-333.16v-39.8H41.6q-36.04 0-55.94-4.28t-30.32-14.56-16.02-28.78-12.6-46.5h-29.04v228.04h29.04q7-27.44 12.6-45.72t16.02-29.06 30.32-15.06 55.94-4.28ZM-128.6-38.48l-73.04-155.28h-30.16L-212.36 0h515.24v-28.48q-33.2-4.44-49.54-9.5t-22.9-16.74q-7.56-12.56-9.06-36.06t-1.5-64.58v-369.28q0-44.44 1.78-68.22t11.02-36.34q7.12-10.44 23.18-14.94t47.02-6.82V-680h-499.12l-10 176.92h30.16l63.04-138.44h235v603.04Z"
        />
        <path
          fill={inverted ? "#fffaf2" : "#2a1c12"}
          d="m204-275-52-2.4 314.72-292.68q20.44-19 30.94-28.72t10.5-21.72q0-14-14.48-21t-41.28-10V-680q31 2 59.04 3t56.68 1q27.4 0 56.8-1t75.04-3v28.48q-32.56 4-56.38 11.32t-45.98 21.76-51.52 40.36Zm79.96-107.72 76.56-56.88 204.56 299.4q27.12 36.36 45.96 57.7t34.64 31.8 33.92 15.12 43.36 7.66V.44q-40.48-2-61.84-2.66t-39.08-.66q-17.68 0-36.16.72T547.96 0Zm-63-163.2v411.84q0 30.36 1.5 49.32t6.94 29.28q7.56 13 24.8 17.78t50.68 9.22V0q-32.04-2-52.12-2.5t-37.84-1-44.4-.5q-24.88 0-42.26.5t-36.96 1T39.12 0v-28.48q32.12-4.44 49.8-9t25.24-17.24q6.32-10.32 7.82-29.28t1.5-51.08v-409.84q0-32.12-1.72-51.08t-7.6-29.28q-7.56-12.68-25.24-17.46t-49.8-8.78V-680q32.6 1 52.18 2t36.96 1.5 42.26.5q26.64 0 44.4-.5t37.84-1.5 52.12-2v28.48q-33.44 4-50.46 8.5t-25.02 18.5q-5.88 10.32-7.16 29t-1.28 49.6"
        />
      </svg>

      {/* Brand Typography */}
      <div className="flex items-baseline space-x-1.5">
        <span
          className={cn(
            "font-serif tracking-tight font-normal",
            config.titleSize,
            inverted ? "text-[#fffaf2]" : "text-[#2a1c12]"
          )}
        >
          NyayaSetu
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "uppercase tracking-[0.2em] font-sans font-semibold",
              config.subSize,
              inverted ? "text-[#d1a46a]" : "text-[#85725f]"
            )}
          >
            BHARAT
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="NyayaSetu Home" {...props}>
        {content}
      </Link>
    );
  }

  return content;
}
