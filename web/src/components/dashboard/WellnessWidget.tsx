import { Link } from "react-router-dom";
import { useReadiness } from "@/hooks/useReadiness";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

interface Props {
  athleteId: string;
}

interface MetricDef {
  label: string;
  icon: string;
  getValue: (row: Row) => number | null;
  format: (v: number) => string;
  getColor?: (v: number) => string;
}

type Row = {
  rmssd_matinal: number | null;
  fc_repos: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  mental_energy: number | null;
};

const METRICS: MetricDef[] = [
  {
    label: "HRV",
    icon: "monitor_heart",
    getValue: (r) => r.rmssd_matinal,
    format: (v) => `${Math.round(v)} ms`,
  },
  {
    label: "FC repos",
    icon: "favorite",
    getValue: (r) => r.fc_repos,
    format: (v) => `${Math.round(v)} bpm`,
  },
  {
    label: "Sommeil",
    icon: "bedtime",
    getValue: (r) => r.sleep_quality,
    format: (v) => `${v}/10`,
    getColor: (v) => (v >= 7 ? "text-emerald-600 dark:text-emerald-400" : v >= 5 ? "text-amber-500" : "text-red-500"),
  },
  {
    label: "Fatigue",
    icon: "battery_alert",
    getValue: (r) => r.fatigue,
    format: (v) => `${v}/10`,
    getColor: (v) => (v <= 3 ? "text-emerald-600 dark:text-emerald-400" : v <= 6 ? "text-amber-500" : "text-red-500"),
  },
  {
    label: "Énergie",
    icon: "bolt",
    getValue: (r) => r.mental_energy,
    format: (v) => `${v}/10`,
    getColor: (v) => (v >= 7 ? "text-emerald-600 dark:text-emerald-400" : v >= 5 ? "text-amber-500" : "text-red-500"),
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function WellnessWidget({ athleteId }: Props) {
  const { healthData, isLoading } = useReadiness(athleteId);

  const row = healthData.find((r) => r.athlete_id === athleteId) ?? null;
  const hasData = row && METRICS.some((m) => m.getValue(row) !== null);

  return (
    <WidgetShell
      title="Bien-être"
      icon="self_improvement"
      isLoading={isLoading}
      isEmpty={!hasData}
      emptyMessage="Aucune donnée de bien-être"
      headerAction={
        <Link
          to="/mon-espace/tendances"
          className="text-xs font-medium text-accent-blue hover:underline"
        >
          Tendances
        </Link>
      }
    >
      {row && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {formatDate(row.date)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m) => {
              const val = m.getValue(row);
              if (val === null) return null;
              const color = m.getColor?.(val);
              return (
                <div key={m.label} className="flex items-center gap-2">
                  <Icon name={m.icon} className="text-base text-slate-400" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {m.label}
                    </p>
                    <p
                      className={cn(
                        "font-mono text-sm font-semibold",
                        color ?? "text-slate-900 dark:text-white"
                      )}
                    >
                      {m.format(val)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
