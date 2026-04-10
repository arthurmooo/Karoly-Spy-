import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import type { TextInsight } from "@/services/analysis.service";

interface TextInsightsProps {
  insights: TextInsight[];
}

const SEVERITY_BADGE: Record<TextInsight["severity"], { variant: "primary" | "amber" | "red"; label: string }> = {
  info: { variant: "primary", label: "Info" },
  warning: { variant: "amber", label: "Attention" },
  alert: { variant: "red", label: "Alerte" },
};

const SEVERITY_ICON_COLOR: Record<TextInsight["severity"], string> = {
  info: "text-blue-500 dark:text-blue-400",
  warning: "text-amber-500 dark:text-amber-400",
  alert: "text-red-500 dark:text-red-400",
};

export function TextInsights({ insights }: TextInsightsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Analyse automatique
        </CardTitle>
        <p className="text-sm text-slate-500">
          Résumé des tendances et alertes sur la période sélectionnée.
        </p>
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        {insights.length === 0 ? (
          <FeatureNotice
            title="Analyse automatique"
            description="Pas assez de données pour générer des insights sur cette période."
            status="unavailable"
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {insights.map((insight) => {
              const badge = SEVERITY_BADGE[insight.severity];
              const iconColor = SEVERITY_ICON_COLOR[insight.severity];
              return (
                <li
                  key={insight.id}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <Icon
                    name={insight.icon}
                    className={`mt-0.5 text-xl ${iconColor}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {insight.title}
                      </p>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    {insight.detail && (
                      <p className="mt-0.5 text-xs text-slate-500">{insight.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
