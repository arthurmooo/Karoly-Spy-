import { type FC, HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  filled?: boolean;
}

/** Cross-country skiing SVG – matches Material Symbols outline style */
const NordicWalkingSvg = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    {/* Head */}
    <circle cx="12" cy="3.5" r="2" />
    {/* Body + legs with ski poles */}
    <path d="M7.5 22l1.7-5.5L11 18v4h2v-5.5l-2.8-2.5 1.1-3.5c1.2 1.4 3 2.5 5.2 2.5v-2c-1.7 0-3.1-.9-3.9-2.1l-1.4-2.1c-.4-.6-1.1-1-1.9-1-.3 0-.5.1-.8.2L4 8.5v5h2V9.7l2.3-.9L6 22h1.5z" />
    {/* Poles */}
    <line x1="4" y1="22" x2="8.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="20" y1="22" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const SVG_ICONS: Record<string, FC<{ className?: string }>> = {
  nordic_walking: NordicWalkingSvg,
};

export const Icon = forwardRef<HTMLSpanElement, IconProps>(
  ({ className, name, filled, ...props }, ref) => {
    const SvgComponent = SVG_ICONS[name];
    if (SvgComponent) {
      return (
        <span ref={ref} className={cn("inline-flex items-center justify-center", className)} {...props}>
          <SvgComponent className="w-[1em] h-[1em]" />
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn("material-symbols-outlined", className)}
        style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
        {...props}
      >
        {name}
      </span>
    );
  }
);
Icon.displayName = "Icon";
