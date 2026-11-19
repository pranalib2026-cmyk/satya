"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen?: boolean;
  open?: boolean; // alias for dashboard compatibility
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  className,
}: ModalProps) {
  const isModalOpen = Boolean(isOpen ?? open);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        onClose();
      }
    };
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, onClose]);

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#24180f]/75 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative z-10 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-8 shadow-[0_20px_50px_rgba(36,24,15,0.25)] my-auto max-h-[90vh] flex flex-col",
              sizeStyles[size],
              className
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-1 text-[#85725f] hover:text-[#2a1c12] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            {(title || description) && (
              <div className="mb-5 space-y-1.5 pr-8 shrink-0">
                {title && (
                  <h3 className="font-serif text-[24px] sm:text-[28px] font-normal leading-[1.15] tracking-[-0.03em] text-[#2a1c12]">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-[#5b4a3b] leading-[1.5]">
                    {description}
                  </p>
                )}
              </div>
            )}

            <div className="overflow-y-auto pr-1 flex-1">{children}</div>

            {footer && (
              <div className="mt-6 pt-4 border-t border-[#e2d5c1] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
