import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { formatDuration } from "@/services/format.service";
import type { WeeklyHeatmapData, WeeklyHeatmapLevel } from "@/services/load.service";

interface WeeklyHeatmapProps {
  data: WeeklyHeatmapData | null;
  isLoading?: boolean;
}

interface LevelStyle {
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  tooltipClass: string;
}

const LEVEL_STYLES: Record<WeeklyHeatmapLevel, LevelStyle> = {
  rest: {
    label: "Repos",
    bgClass: "bg-slate-100 dark:bg-slate-800/80",
    borderClass: "border-slate-200 dark:border-slate-700",
    textClass: "text-slate-600 dark:text-slate-300",
    tooltipClass: "text-slate-300",
  },
  low: {
    label: "Faible",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/40",
    borderClass: "border-emerald-200 dark:border-emerald-900/70",
    textClass: "text-emerald-700 dark:text-emerald-300",
    tooltipClass: "text-emerald-300",
  },
  moderate: {
    label: "Moderee",
    bgClass: "bg-amber-100 dark:bg-amber-950/40",
    borderClass: "border-amber-200 dark:border-amber-900/70",
    textClass: "text-amber-700 dark:text-amber-300",
    tooltipClass: "text-amber-300",
  },
  high: {
    label: "Elevee",
    bgClass: "bg-orange-100 dark:bg-orange-950/40",
    borderClass: "border-orange-200 dark:border-orange-900/70",
    textClass: "text-orange-700 dark:text-orange-300",
    tooltipClass: "text-orange-300",
  },
  very_high: {
    label: "Tres elevee",
    bgClass: "bg-rose-100 dark:bg-rose-950/40",
    borderClass: "border-rose-200 dark:border-rose-900/70",
    textClass: "text-rose-700 dark:text-rose-300",
    tooltipClass: "text-rose-300",
  },
};

function formatTooltipDate(isoDate: string): string {
  return format(parseISO(isoDate), "EEEE d MMM yyyy", { locale: fr });
}

export function WeeklyHeatmap({ data, isLoading = false }: WeeklyHeatmapProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-sm border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
            />
          ))}
        </div>
        <div className="h-4 w-56 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <Icon name="calendar_today" className="text-lg" />
        Aucune donnee de charge disponible.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
          {data.days.map((day, index) => {
            const style = LEVEL_STYLES[day.level];
            const tooltip = [
              formatTooltipDate(day.date),
              `${Math.round(day.mls).toLocaleString("fr-FR")} MLS`,
              `${formatDuration(day.durationSec)} d'effort`,
              `${day.sessionCount} seance${day.sessionCount > 1 ? "s" : ""}`,
              style.label,
            ].join(" • ");

            // Align tooltip left/right for edge cells to avoid overflow clipping
            const tooltipPos =
              index <= 1
                ? "left-0"
                : index >= 5
                  ? "right-0"
                  : "left-1/2 -translate-x-1/2";

            return (
              <div
                key={day.date}
                tabIndex={0}
                title={tooltip}
                className={`group relative flex min-h-28 flex-col justify-between rounded-sm border px-3 py-3 transition-transform focus:outline-none focus:ring-2 focus:ring-primary/50 ${style.bgClass} ${style.borderClass}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {day.label}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${style.textClass}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(parseISO(day.date), "d MMM", { locale: fr })}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
                    {Math.round(day.mls).toLocaleString("fr-FR")}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span>{formatDuration(day.durationSec)}</span>
                    <span>{day.sessionCount} seance{day.sessionCount > 1 ? "s" : ""}</span>
                  </div>
                </div>

                <div className={`pointer-events-none absolute bottom-full z-20 hidden w-56 pb-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100 lg:block ${tooltipPos}`}>
                  <div className="rounded-sm bg-slate-900 px-3 py-2 text-xs text-white shadow-xl dark:bg-slate-700">
                    <p className="font-semibold capitalize text-slate-100">
                      {formatTooltipDate(day.date)}
                    </p>
                    <p className="mt-1 text-slate-200">
                      {Math.round(day.mls).toLocaleString("fr-FR")} MLS
                    </p>
                    <p className="text-slate-300">{formatDuration(day.durationSec)} d'effort</p>
                    <p className="text-slate-300">
                      {day.sessionCount} seance{day.sessionCount > 1 ? "s" : ""}
                    </p>
                    <p className={`mt-1 font-semibold ${style.tooltipClass}`}>
                      {style.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>Faible charge</span>
        <div className="flex items-center gap-1">
          {(["rest", "low", "moderate", "high", "very_high"] as const).map((level) => {
            const style = LEVEL_STYLES[level];
            return (
              <div
                key={level}
                className={`h-4 w-6 rounded-sm border ${style.bgClass} ${style.borderClass}`}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <span>Charge elevee</span>
      </div>
    </div>
  );
}
