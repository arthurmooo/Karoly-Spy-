import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SortDirection } from "@/lib/tableSort";
import { getAriaSort } from "@/lib/tableSort";

interface Props {
  label: ReactNode;
  active: boolean;
  direction?: SortDirection;
  onToggle: () => void;
  className?: string;
}

export function SortableHeader({ label, active, direction, onToggle, className }: Props) {
  const iconName = active ? (direction === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more";

  return (
    <th aria-sort={getAriaSort(active, direction)} className={cn("px-4 py-3", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 text-inherit transition-colors hover:text-slate-700 dark:hover:text-slate-200"
      >
        <span>{label}</span>
        <Icon
          name={iconName}
          className={cn(
            "text-sm",
            active ? "text-primary dark:text-primary" : "text-slate-400"
          )}
        />
      </button>
    </th>
  );
}
