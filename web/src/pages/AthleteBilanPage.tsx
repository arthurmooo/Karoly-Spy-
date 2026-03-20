import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import {
  Disclosure,
  DisclosureTrigger,
  DisclosureContent,
  useDisclosureContext,
} from "@/components/ui/Disclosure";
import { KpiCards } from "@/components/kpis/KpiCards";
import { VolumeDistribution } from "@/components/charts/VolumeDistribution";
import { LoadEvolution } from "@/components/charts/LoadEvolution";
import { AcwrMetricCard } from "@/components/load/AcwrMetricCard";
import { WeeklyHeatmap } from "@/components/charts/WeeklyHeatmap";
import { FocusCoach } from "@/components/analysis/FocusCoach";
import { TextInsights } from "@/components/analysis/TextInsights";
import { HrZonesBilan } from "@/components/analysis/HrZonesBilan";
import { AthleteSubNav } from "@/components/layout/AthleteSubNav";
import { useAuth } from "@/hooks/useAuth";
import { useAthleteKpis } from "@/hooks/useAthleteKpis";
import { useExportBilan } from "@/hooks/useExportBilan";
import { useAcwr } from "@/hooks/useAcwr";
import { getAthleteById } from "@/repositories/athlete.repository";
import { getAthleteDailyLoadHistory } from "@/repositories/load.repository";
import { buildWeeklyHeatmapData, type WeeklyHeatmapData } from "@/services/load.service";
import { getSportConfig } from "@/lib/constants";
import type { Athlete } from "@/types/athlete";
import type { KpiPeriod } from "@/services/stats.service";

interface AthleteBilanPageProps {
  athleteId?: string;
}

const PERIOD_OPTIONS: Array<{ key: KpiPeriod; label: string }> = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
];

function getDecouplingBadgeVariant(value: number | null): "emerald" | "amber" | "red" | "slate" {
  if (value == null) return "slate";
  if (Math.abs(value) < 5) return "emerald";
  if (Math.abs(value) < 10) return "amber";
  return "red";
}

export function AthleteBilanPage({ athleteId: propAthleteId }: AthleteBilanPageProps = {}) {
  const { id: paramAthleteId } = useParams();
  const athleteId = propAthleteId ?? paramAthleteId ?? null;
  const isAthleteMode = !!propAthleteId;
  const { role } = useAuth();
  const showCoachAcwr = role === "coach" && !isAthleteMode && !!athleteId;

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [athleteLoading, setAthleteLoading] = useState(true);
  const [period, setPeriod] = useState<KpiPeriod>("week");
  const [weeklyHeatmapData, setWeeklyHeatmapData] = useState<WeeklyHeatmapData | null>(null);
  const [isWeeklyHeatmapLoading, setIsWeeklyHeatmapLoading] = useState(false);

  const { report, isLoading } = useAthleteKpis(athleteId, period);
  const { detail: acwrDetail, isLoading: acwrLoading } = useAcwr({ athleteId, enabled: !!athleteId });
  const { exportPdf, isExporting } = useExportBilan();

  useEffect(() => {
    if (!athleteId) {
      setAthlete(null);
      setAthleteLoading(false);
      return;
    }

    let cancelled = false;
    setAthleteLoading(true);

    getAthleteById(athleteId)
      .then((data) => {
        if (!cancelled) setAthlete(data);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setAthlete(null);
      })
      .finally(() => {
        if (!cancelled) setAthleteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  useEffect(() => {
    let isCancelled = false;

    if (!athleteId) {
      setWeeklyHeatmapData(null);
      setIsWeeklyHeatmapLoading(false);
      return () => { isCancelled = true; };
    }

    const todayIso = format(new Date(), "yyyy-MM-dd");
    setIsWeeklyHeatmapLoading(true);

    getAthleteDailyLoadHistory(athleteId, todayIso)
      .then((rows) => {
        if (isCancelled) return;
        setWeeklyHeatmapData(buildWeeklyHeatmapData(rows, todayIso));
      })
      .catch((error) => {
        console.error(error);
        if (isCancelled) return;
        setWeeklyHeatmapData(null);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsWeeklyHeatmapLoading(false);
      });

    return () => { isCancelled = true; };
  }, [athleteId]);

  if (athleteLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon name="progress_activity" className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  if (!athlete || !report) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <p className="text-sm text-slate-500">Bilan athlète introuvable.</p>
        {!isAthleteMode && (
          <Link to="/athletes">
            <Button variant="secondary">
              <Icon name="arrow_back" className="text-sm" />
              Retour aux athlètes
            </Button>
          </Link>
        )}
      </div>
    );
  }

  const athleteName = `${athlete.first_name} ${athlete.last_name}`;

  return (
    <div className="space-y-8">
      {!isAthleteMode && (
        <AthleteSubNav athlete={athlete} active="bilan" />
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {isAthleteMode ? "Mon bilan" : `Bilan KPI · ${athleteName}`}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.periodLabel} · {report.currentRangeLabel}
          </p>
          <p className="text-sm text-slate-500">
            Comparaison à date · {report.comparisonRangeLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-sm border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setPeriod(option.key)}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === option.key
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            disabled={isExporting || !report}
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            onClick={() => {
              if (!report) return;
              const acwrMetrics = acwrDetail
                ? [acwrDetail.external, acwrDetail.internal, acwrDetail.global]
                : undefined;
              exportPdf(report, athleteName, acwrMetrics);
            }}
          >
            <Icon
              name={isExporting ? "progress_activity" : "download"}
              className={`text-sm ${isExporting ? "animate-spin" : ""}`}
            />
            {isExporting ? "Export..." : "Exporter PDF"}
          </Button>

        </div>
      </div>

      {report.focusAlert && <FocusCoach alert={report.focusAlert} />}

      <KpiCards cards={report.cards} />

      {/* ── Section Volume & Charge ── */}
      <BilanSection icon="bar_chart" title="Volume & Charge">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <VolumeDistribution items={report.distribution} />
          </div>
          <div className="xl:col-span-3">
            <LoadEvolution points={report.weeklyLoad} />
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Icon name="calendar_view_week" className="text-slate-500 dark:text-slate-400" />
                  Heatmap charge 7j
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Répartition MLS de la semaine en cours.
                </p>
              </div>
              {weeklyHeatmapData && (
                <Badge variant="slate" className="w-fit">
                  {format(parseISO(weeklyHeatmapData.weekStart), "d MMM", { locale: fr })} — {format(parseISO(weeklyHeatmapData.weekEnd), "d MMM yyyy", { locale: fr })}
                </Badge>
              )}
            </div>
            <WeeklyHeatmap data={weeklyHeatmapData} isLoading={isWeeklyHeatmapLoading} />
          </CardContent>
        </Card>
      </BilanSection>

      {/* ── Section ACWR — coach only ── */}
      {showCoachAcwr && (
        <BilanSection icon="monitoring" title="ACWR">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Vue coach V1 basée sur la durée active, la charge sRPE et le MLS.
            </p>
            {acwrDetail?.latest_session_date && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Dernière séance: {format(parseISO(acwrDetail.latest_session_date), "d MMM yyyy", { locale: fr })}
              </span>
            )}
          </div>

          {acwrLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Chargement ACWR...
              </CardContent>
            </Card>
          ) : acwrDetail ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <AcwrMetricCard metric={acwrDetail.external} lastSessionDate={acwrDetail.latest_session_date} />
              <AcwrMetricCard metric={acwrDetail.internal} lastSessionDate={acwrDetail.latest_session_date} />
              <AcwrMetricCard metric={acwrDetail.global} lastSessionDate={acwrDetail.latest_session_date} />
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Aucune donnée ACWR disponible pour cet athlète.
              </CardContent>
            </Card>
          )}
        </BilanSection>
      )}

      {/* ── Section Physiologie ── */}
      <BilanSection icon="cardiology" title="Physiologie">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-900 dark:text-white">
              Découplage par sport
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.sportDecoupling.length === 0 ? (
              <FeatureNotice
                title="Découplage par sport"
                description="Aucune séance disponible pour établir un découplage moyen."
                status="unavailable"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {report.sportDecoupling.map((item) => {
                  const config = getSportConfig(item.sportKey);
                  return (
                    <div
                      key={item.sportKey}
                      className="flex items-center justify-between gap-4 rounded-sm border border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-sm p-2 ${config.bgLight}`}>
                          <Icon name={config.icon} className={config.textColor} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                          <p className="text-xs text-slate-500">
                            {item.sessionCount} séance{item.sessionCount > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <Badge variant={getDecouplingBadgeVariant(item.avgDecoupling)}>
                        {item.displayValue}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <HrZonesBilan hrZones={report.hrZones} />
      </BilanSection>

      {/* ── Section Synthèse ── */}
      <BilanSection icon="auto_awesome" title="Synthèse">
        <TextInsights insights={report.insights} />
      </BilanSection>
    </div>
  );
}

/* ── Helpers ── */

function SectionChevron() {
  const { isOpen } = useDisclosureContext();
  return (
    <Icon
      name="expand_more"
      className={`text-slate-400 text-[18px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
    />
  );
}

function BilanSection({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      <DisclosureTrigger className="group flex w-full items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Icon name={icon} className="text-lg text-blue-600 dark:text-blue-400" />
          {title}
        </h2>
        <SectionChevron />
      </DisclosureTrigger>
      <DisclosureContent>
        <div className="space-y-4 pt-2">{children}</div>
      </DisclosureContent>
    </Disclosure>
  );
}
