import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  filled?: boolean;
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(
  ({ className, name, filled, ...props }, ref) => {
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
