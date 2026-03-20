import { Card, CardContent } from "@/components/ui/Card";
import { AcwrStatusBadge } from "@/components/load/AcwrStatusBadge";
import type { AcwrMetricSnapshot } from "@/types/acwr";

interface Props {
  metric: AcwrMetricSnapshot;
  lastSessionDate: string | null;
}

function formatValue(value: number | null, suffix = "") {
  if (value === null) return "—";
  return `${value.toFixed(suffix === "" ? 2 : 1)}${suffix ? ` ${suffix}` : ""}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AcwrMetricCard({ metric, lastSessionDate }: Props) {
  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {metric.label}
            </p>
            <h3 className="text-3xl font-semibold text-slate-900 dark:text-white font-mono">
              {metric.ratio !== null ? metric.ratio.toFixed(2) : "—"}
            </h3>
          </div>
          <AcwrStatusBadge status={metric.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Charge aiguë 7j
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
              {formatValue(metric.acute_7d)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Chronique 28j / 4
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
              {formatValue(metric.chronic_28d_weekly_equiv)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Dernière séance: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(lastSessionDate)}</span>
          </span>
          {metric.coverage_pct !== null && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Couverture RPE: <span className="font-medium text-slate-700 dark:text-slate-300">{metric.coverage_pct.toFixed(1)}%</span>
            </span>
          )}
        </div>

        {metric.note && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {metric.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
