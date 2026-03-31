import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";
import { getCardMeta } from "@/components/kpis/KpiCards";
import type { AthleteKpiReport, KpiCard } from "@/services/stats.service";

interface Props {
  report: AthleteKpiReport | null;
  isLoading: boolean;
}

const DASHBOARD_CARDS: KpiCard["key"][] = ["distance", "hours", "sessions", "rpe"];

export function WeeklySummaryWidget({ report, isLoading }: Props) {
  const cards = report?.cards.filter((c) => DASHBOARD_CARDS.includes(c.key)) ?? [];

  return (
    <WidgetShell
      title="Cette semaine"
      icon="bar_chart"
      isLoading={isLoading}
      isEmpty={cards.length === 0}
      emptyMessage="Aucune activité cette semaine"
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const meta = getCardMeta(card.key, card.value);
          const deltaPositive = card.deltaPct != null && card.deltaPct > 0;
          const deltaZero = card.deltaPct == null || card.deltaPct === 0;

          return (
            <div key={card.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${meta.iconBg}`}
                >
                  <Icon name={meta.icon} className={`text-xs ${meta.iconText}`} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {card.label}
                </span>
              </div>
              <p className="font-mono text-xl font-semibold text-slate-900 dark:text-white">
                {card.displayValue}
              </p>
              <div className="h-4">
                {!deltaZero && card.deltaDisplay ? (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      deltaPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    <Icon
                      name={deltaPositive ? "arrow_upward" : "arrow_downward"}
                      className="text-[10px]"
                    />
                    {card.deltaDisplay}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}
