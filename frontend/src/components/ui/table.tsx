import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto border border-[#e2d5c1] bg-[#fffaf2] rounded-[2px]">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-[#e2d5c1] bg-[#ebe1d1]/40 text-[11px] font-sans uppercase tracking-[0.14em] text-[#85725f]",
        className
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-[#e2d5c1] text-[#2a1c12]", className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  clickable,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[#ebe1d1]/30",
        clickable && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3.5 font-medium whitespace-nowrap", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3.5 text-sm align-middle leading-relaxed", className)}
      {...props}
    >
      {children}
    </td>
  );
}
