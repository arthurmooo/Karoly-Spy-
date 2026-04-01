import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { getSportConfig } from "@/lib/constants";
import { Icon } from "@/components/ui/Icon";
import { formatHoursHuman } from "@/services/format.service";
import type { SportDistributionItem } from "@/services/stats.service";

interface Props {
  distribution: SportDistributionItem[];
  isLoading: boolean;
}

export function SportDistributionWidget({ distribution, isLoading }: Props) {
  const items = distribution.filter((d) => d.percent > 0);

  return (
    <WidgetShell
      title="Répartition sports"
      icon="donut_large"
      isLoading={isLoading}
      isEmpty={items.length === 0}
      emptyMessage="Aucune activité cette semaine"
    >
      <div className="space-y-3">
        {items.map((item) => {
          const cfg = getSportConfig(item.sportKey);
          return (
            <div key={item.sportKey} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon name={cfg.icon} className={`text-base ${cfg.textColor}`} />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {item.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {formatHoursHuman(item.hours)} · {item.sessionCount} séance{item.sessionCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(item.percent, 2)}%`,
                    backgroundColor: cfg.hexColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}
