import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "orange" | "green" | "slate" | "red" | "amber" | "emerald";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "slate", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider border",
          {
            "bg-primary/5 border-primary/20 text-primary": variant === "primary",
            "bg-accent-orange/5 border-accent-orange/20 text-accent-orange": variant === "orange",
            "bg-accent-green/5 border-accent-green/20 text-accent-green": variant === "green",
            "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400": variant === "slate",
            "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400": variant === "red",
            "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400": variant === "amber",
            "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400": variant === "emerald",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
