import { Icon } from "@/components/ui/Icon";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import type { KpiPeriod } from "@/services/stats.service";

const PERIOD_OPTIONS: Array<{ key: KpiPeriod; label: string }> = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
];

interface BilanPeriodToolbarProps {
  period: KpiPeriod;
  periodTitle: string;
  rangeLabel: string;
  comparisonLabel: string;
  onPeriodChange: (period: KpiPeriod) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onTodayClick: () => void;
  isCurrentPeriod: boolean;
}

export function BilanPeriodToolbar({
  period,
  periodTitle,
  rangeLabel,
  comparisonLabel,
  onPeriodChange,
  onNavigate,
  onTodayClick,
  isCurrentPeriod,
}: BilanPeriodToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left — Nav + title + today */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Grouped chevron capsule */}
          <div className="flex items-center rounded-xl bg-slate-100/80 dark:bg-slate-800/60 p-0.5 shrink-0">
            <button
              onClick={() => onNavigate("prev")}
              className="p-1.5 rounded-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all duration-150"
              aria-label="Période précédente"
            >
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            <button
              onClick={() => onNavigate("next")}
              className="p-1.5 rounded-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all duration-150"
              aria-label="Période suivante"
            >
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>

          {/* Title + date range */}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white truncate leading-tight capitalize">
              {periodTitle}
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate leading-snug mt-0.5">
              {rangeLabel}
              <span className="hidden sm:inline">
                {" "}&middot; vs {comparisonLabel}
              </span>
            </p>
          </div>

          {/* Today pill */}
          {!isCurrentPeriod && (
            <button
              onClick={onTodayClick}
              className="ml-1 px-3 py-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400 rounded-full bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all duration-150 whitespace-nowrap shrink-0"
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {/* Right — Segmented control */}
        <div className="shrink-0 self-start sm:self-auto min-w-[200px]">
          <SlidingTabs items={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} rounded="xl" />
        </div>
      </div>
    </div>
  );
}
