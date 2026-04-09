"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";

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
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const isMobile = useIsMobile();

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
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

  // Compute dropdown position from trigger rect (desktop only)
  const updatePos = useCallback(() => {
    if (!rootRef.current || isMobile) return;
    const rect = rootRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [isMobile]);

  // Position + reposition on scroll/resize while open (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [isOpen, updatePos, isMobile]);

  // Click outside → close (desktop only, mobile uses overlay)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        listRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, isMobile]);

  // Auto-focus input when opening (desktop)
  useEffect(() => {
    if (isOpen && !isMobile) inputRef.current?.focus();
  }, [isOpen, isMobile]);

  // Auto-focus input when opening (mobile — with delay for iOS)
  useEffect(() => {
    if (isOpen && isMobile) {
      const timer = setTimeout(() => mobileInputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMobile]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, isMobile]);

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

  // ── Option list renderer (shared between desktop and mobile) ──
  const renderOptions = (refProp: React.Ref<HTMLUListElement>, extraClass?: string) => (
    <ul ref={refProp} className={cn("overflow-y-auto py-1", extraClass)}>
      {filtered.length === 0 ? (
        <li className="px-3 py-2.5 text-sm text-slate-400 italic">
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
            onClick={() => {
              select(opt.value);
            }}
            onMouseEnter={() => setHighlightedIndex(i)}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer",
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
  );

  // ── Desktop dropdown (portal, fixed position) ──
  const desktopDropdown =
    isOpen && !isMobile && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1"
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
          </ul>,
          document.body
        )
      : null;

  // ── Mobile bottom sheet (portal, fullscreen overlay) ──
  const mobileSheet =
    isOpen && isMobile && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop — tap to dismiss */}
            <button
              type="button"
              className="flex-1 bg-black/40 backdrop-blur-[2px]"
              onClick={() => { setIsOpen(false); setSearch(""); }}
              aria-label="Fermer"
            />
            {/* Sheet */}
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-200">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              {/* Title */}
              <div className="px-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {placeholder}
                </p>
              </div>
              {/* Search input */}
              <div className="px-4 pb-3">
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
                  />
                  <input
                    ref={mobileInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Rechercher…"
                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl pl-9 pr-4 py-3 text-base text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-blue placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              {/* Options list */}
              {renderOptions(listRef, "flex-1 min-h-0 pb-6")}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Trigger / Input */}
      {isOpen && !isMobile ? (
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

      {desktopDropdown}
      {mobileSheet}
    </div>
  );
}
