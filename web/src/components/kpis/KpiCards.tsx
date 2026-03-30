import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getDecouplingState } from "@/lib/karolyMetrics";
import type { KpiCard } from "@/services/stats.service";

interface KpiCardsProps {
  cards: KpiCard[];
}

interface CardMeta {
  icon: string;
  iconBg: string;
  iconText: string;
}

function getCardMeta(key: KpiCard["key"], value: number | null): CardMeta {
  switch (key) {
    case "distance":
      return { icon: "straighten", iconBg: "bg-orange-500/10", iconText: "text-orange-500" };
    case "hours":
      return { icon: "schedule", iconBg: "bg-blue-500/10", iconText: "text-blue-500" };
    case "sessions":
      return { icon: "fitness_center", iconBg: "bg-teal-500/10", iconText: "text-teal-600" };
    case "rpe":
      return { icon: "sentiment_neutral", iconBg: "bg-amber-500/10", iconText: "text-amber-500" };
    case "decoupling": {
      const state = getDecouplingState(value);
      if (state === "none")
        return {
          icon: "monitor_heart",
          iconBg: "bg-slate-100 dark:bg-slate-800",
          iconText: "text-slate-400",
        };
      if (state === "good")
        return { icon: "monitor_heart", iconBg: "bg-emerald-500/10", iconText: "text-emerald-500" };
      if (state === "moderate")
        return { icon: "monitor_heart", iconBg: "bg-amber-500/10", iconText: "text-amber-500" };
      return { icon: "monitor_heart", iconBg: "bg-red-500/10", iconText: "text-red-500" };
    }
  }
}

export function KpiCards({ cards }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const meta = getCardMeta(card.key, card.value);
        const deltaPositive = card.deltaPct != null && card.deltaPct > 0;
        const deltaZero = card.deltaPct == null || card.deltaPct === 0;
        return (
          <Card key={card.key}>
            <CardContent className="p-5">
              <div
                className={`w-8 h-8 rounded-full ${meta.iconBg} flex items-center justify-center mb-3`}
              >
                <Icon name={meta.icon} className={`text-sm ${meta.iconText}`} />
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {card.label}
              </p>
              <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">
                {card.displayValue}
              </h3>
              <div className="mt-1.5 h-4">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
