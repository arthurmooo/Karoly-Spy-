"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  icon?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  className,
  disabled,
  icon,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length]);

  // Click outside → close
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // Auto-focus input when opening
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const select = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          select(filtered[highlightedIndex].value);
        }
      }
    },
    [filtered, highlightedIndex, select]
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Trigger / Input */}
      {isOpen ? (
        <div className="relative">
          {icon && (
            <Icon
              name={icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedLabel || placeholder}
            className={cn(
              "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 placeholder:text-slate-400 dark:placeholder:text-slate-500",
              icon && "pl-8"
            )}
          />
          <Icon
            name="expand_less"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(true)}
          className={cn(
            "w-full text-left bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            selectedLabel
              ? "text-slate-700 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500",
            icon && "pl-8"
          )}
        >
          {icon && (
            <Icon
              name={icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
            />
          )}
          <span className="block truncate">{selectedLabel || placeholder}</span>
          <Icon
            name="expand_more"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
          />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400 italic">
              Aucun résultat
            </li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt.value);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm cursor-pointer",
                  i === highlightedIndex
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                  opt.value === value
                    ? "text-accent-blue font-medium"
                    : "text-slate-700 dark:text-slate-300"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && (
                  <Icon name="check" className="text-base text-accent-blue shrink-0 ml-2" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
