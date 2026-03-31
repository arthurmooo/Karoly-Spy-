import { Link } from "react-router-dom";
import { useAcwr } from "@/hooks/useAcwr";
import { AcwrStatusBadge } from "@/components/load/AcwrStatusBadge";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";

interface Props {
  athleteId: string;
}

function formatVal(v: number | null) {
  return v !== null ? v.toFixed(1) : "—";
}

export function AcwrWidget({ athleteId }: Props) {
  const { detail, isLoading } = useAcwr({ athleteId });
  const metric = detail?.global ?? null;

  return (
    <WidgetShell
      title="État de forme"
      icon="monitor_heart"
      isLoading={isLoading}
      isEmpty={!metric}
      emptyMessage="Données insuffisantes"
      headerAction={
        <Link
          to="/mon-espace/tendances"
          className="text-xs font-medium text-accent-blue hover:underline"
        >
          Détails
        </Link>
      }
    >
      {metric && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Ratio ACWR
              </p>
              <p className="font-mono text-3xl font-semibold text-slate-900 dark:text-white">
                {metric.ratio !== null ? metric.ratio.toFixed(2) : "—"}
              </p>
            </div>
            <AcwrStatusBadge status={metric.status} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Aiguë 7j
              </p>
              <p className="text-sm font-semibold font-mono text-slate-900 dark:text-white">
                {formatVal(metric.acute_7d)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Chronique 28j
              </p>
              <p className="text-sm font-semibold font-mono text-slate-900 dark:text-white">
                {formatVal(metric.chronic_28d_weekly_equiv)}
              </p>
            </div>
          </div>

          {metric.note && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <Icon name="info" className="mr-1 text-xs align-middle" />
              {metric.note}
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
