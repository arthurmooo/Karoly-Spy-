import { useRef, useLayoutEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface SlidingTabItem<K extends string = string> {
  key: K;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
  href?: string;
  disabled?: boolean;
}

interface SlidingTabsProps<K extends string = string> {
  items: SlidingTabItem<K>[];
  value: K;
  onChange?: (value: K) => void;
  size?: "sm" | "md";
  rounded?: "full" | "lg" | "xl";
  className?: string;
}

export function SlidingTabs<K extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  rounded = "full",
  className,
}: SlidingTabsProps<K>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<K, HTMLElement>>(new Map());
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current.get(value);
    const track = trackRef.current;
    if (!btn || !track) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPill({
      left: btnRect.left - trackRect.left,
      width: btnRect.width,
    });
  }, [value]);

  const roundedClass = {
    full: "rounded-full",
    lg: "rounded-lg",
    xl: "rounded-xl",
  }[rounded];

  const pillRounded = {
    full: "rounded-full",
    lg: "rounded-md",
    xl: "rounded-[10px]",
  }[rounded];

  const sizeClass = size === "sm"
    ? "px-2.5 py-1 text-xs"
    : "px-4 py-1.5 text-sm";

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 gap-0.5 max-w-full",
        roundedClass,
        className,
      )}
    >
      {/* Sliding pill */}
      <div
        className={cn(
          "absolute top-1 bottom-1 bg-white dark:bg-slate-700 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          pillRounded,
        )}
        style={{ left: pill.left, width: pill.width }}
      />

      {items.map((item) => {
        const isActive = item.key === value;
        const sharedClassName = cn(
          "relative z-10 font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5",
          sizeClass,
          pillRounded,
          isActive
            ? "text-slate-900 dark:text-white"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          item.disabled && "opacity-40 cursor-not-allowed",
        );

        const content = (
          <>
            {item.icon}
            {item.shortLabel ? (
              <>
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.shortLabel}</span>
              </>
            ) : (
              item.label
            )}
          </>
        );

        const setRef = (el: HTMLElement | null) => {
          if (el) btnRefs.current.set(item.key, el);
        };

        if (item.href) {
          return (
            <Link
              key={item.key}
              ref={setRef}
              to={item.href}
              className={sharedClassName}
              onClick={(e) => {
                if (item.disabled) { e.preventDefault(); return; }
                onChange?.(item.key);
              }}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            ref={setRef}
            type="button"
            disabled={item.disabled}
            onClick={() => onChange?.(item.key)}
            className={sharedClassName}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
