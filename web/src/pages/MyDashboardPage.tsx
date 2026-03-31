import { useState } from "react";
import { Link } from "react-router-dom";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { useMyAthleteProfile } from "@/hooks/useMyAthleteProfile";
import { useAthleteKpis } from "@/hooks/useAthleteKpis";
import { useDashboardPreferences, type WidgetId } from "@/hooks/useDashboardPreferences";
import { Icon } from "@/components/ui/Icon";
import { Card, CardContent } from "@/components/ui/Card";
import { getCardMeta } from "@/components/kpis/KpiCards";
import { LastSessionWidget } from "@/components/dashboard/LastSessionWidget";
import { NextPlannedWidget } from "@/components/dashboard/NextPlannedWidget";
import { AcwrWidget } from "@/components/dashboard/AcwrWidget";
import { WellnessWidget } from "@/components/dashboard/WellnessWidget";
import { CoachFeedbackWidget } from "@/components/dashboard/CoachFeedbackWidget";
import { SportDistributionWidget } from "@/components/dashboard/SportDistributionWidget";
import { DashboardSettingsDialog } from "@/components/dashboard/DashboardSettingsDialog";
import type { KpiCard } from "@/services/stats.service";

const TODAY_LABEL = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DASHBOARD_CARDS: KpiCard["key"][] = ["distance", "hours", "sessions", "rpe"];

const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

function getKpiLink(key: KpiCard["key"]): string {
  if (key === "sessions") return `/mon-espace/seances?from=${weekStart}&to=${weekEnd}`;
  return "/mon-espace/bilan";
}

export function MyDashboardPage() {
  const { profile, isLoading: profileLoading } = useMyAthleteProfile();
  const { report, isLoading: kpiLoading } = useAthleteKpis(
    profile?.id ?? null,
    "week"
  );
  const { visibleWidgets, prefs, toggleWidget, moveWidget, resetDefaults } =
    useDashboardPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Icon
          name="progress_activity"
          className="animate-spin text-3xl text-slate-400"
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-500">Profil athlète introuvable.</p>
      </div>
    );
  }

  const athleteId = profile.id;
  const cards = report?.cards.filter((c) => DASHBOARD_CARDS.includes(c.key)) ?? [];
  const showKpis = visibleWidgets.includes("weekly-summary");

  // Content widgets (everything except weekly-summary)
  const contentWidgets = visibleWidgets.filter((id) => id !== "weekly-summary");

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "last-session":
        return <LastSessionWidget key={id} athleteId={athleteId} />;
      case "next-planned":
        return <NextPlannedWidget key={id} athleteId={athleteId} />;
      case "acwr":
        return <AcwrWidget key={id} athleteId={athleteId} />;
      case "wellness":
        return <WellnessWidget key={id} athleteId={athleteId} />;
      case "coach-feedback":
        return (
          <div key={id} className="md:col-span-2">
            <CoachFeedbackWidget athleteId={athleteId} />
          </div>
        );
      case "sport-distribution":
        return (
          <div key={id} className="md:col-span-2">
            <SportDistributionWidget
              distribution={report?.distribution ?? []}
              isLoading={kpiLoading}
            />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Bonjour {profile.first_name}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500 dark:text-slate-400">
            {TODAY_LABEL}
          </p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Icon name="tune" className="text-base" />
          <span className="hidden sm:inline">Personnaliser</span>
        </button>
      </div>

      {/* ── KPI Cards Row ── */}
      {showKpis && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpiLoading
            ? DASHBOARD_CARDS.map((key) => (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800 skeleton" />
                        <div className="h-6 w-12 rounded bg-slate-100 dark:bg-slate-800 skeleton" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : cards.map((card) => {
                const meta = getCardMeta(card.key, card.value);
                const deltaPositive = card.deltaPct != null && card.deltaPct > 0;
                const deltaZero = card.deltaPct == null || card.deltaPct === 0;

                return (
                  <Link key={card.key} to={getKpiLink(card.key)} className="block">
                    <Card className="cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {card.label}
                            </p>
                            <h3 className="font-mono text-xl font-semibold text-slate-900 dark:text-white">
                              {card.displayValue}
                            </h3>
                            <div className="mt-1 h-4">
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
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.iconBg}`}
                          >
                            <Icon name={meta.icon} className={`text-sm ${meta.iconText}`} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
        </div>
      )}

      {/* ── Content Widgets Grid ── */}
      {contentWidgets.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {contentWidgets.map(renderWidget)}
        </div>
      )}

      {/* ── Settings Dialog ── */}
      <DashboardSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onToggle={toggleWidget}
        onMove={moveWidget}
        onReset={resetDefaults}
      />
    </div>
  );
}
