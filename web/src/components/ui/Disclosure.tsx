"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DisclosureContextValue {
  isOpen: boolean;
  toggle: () => void;
}

const DisclosureContext = createContext<DisclosureContextValue | null>(null);

export function useDisclosureContext() {
  const ctx = useContext(DisclosureContext);
  if (!ctx) throw new Error("useDisclosureContext must be used within <Disclosure>");
  return ctx;
}

export function Disclosure({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <DisclosureContext.Provider value={{ isOpen, toggle: () => setIsOpen((v) => !v) }}>
      {children}
    </DisclosureContext.Provider>
  );
}

export function DisclosureTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen, toggle } = useDisclosureContext();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      className={cn("w-full cursor-pointer select-none text-left", className)}
    >
      {children}
    </button>
  );
}

export function DisclosureContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isOpen } = useDisclosureContext();
  return (
    <div
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className={cn("overflow-hidden", className)}>{children}</div>
    </div>
  );
}
