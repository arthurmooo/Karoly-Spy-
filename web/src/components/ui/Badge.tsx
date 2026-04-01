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
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
          {
            "bg-primary/5 border-primary/20 text-primary dark:bg-blue-500/10 dark:border-blue-400/30 dark:text-blue-400": variant === "primary",
            "bg-accent-orange/5 border-accent-orange/20 text-accent-orange dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400": variant === "orange",
            "bg-accent-green/5 border-accent-green/20 text-accent-green dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400": variant === "green",
            "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300": variant === "slate",
            "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300": variant === "red",
            "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300": variant === "amber",
            "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300": variant === "emerald",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
