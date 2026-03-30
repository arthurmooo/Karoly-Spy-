import { Icon } from "@/components/ui/Icon";
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
        <div className="relative grid grid-cols-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 p-1 shrink-0 self-start sm:self-auto min-w-[200px]">
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-[10px] bg-white dark:bg-slate-700 shadow-sm transition-all duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{
              width: "calc(50% - 4px)",
              left: period === "week" ? "4px" : "calc(50%)",
            }}
          />
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => onPeriodChange(option.key)}
              className={`relative z-10 rounded-[10px] py-1.5 text-[13px] font-medium text-center transition-colors duration-200 ${
                period === option.key
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
