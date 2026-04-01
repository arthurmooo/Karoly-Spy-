import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams, useOutletContext } from "react-router-dom";
import { addMonths, addWeeks, endOfWeek, format, parseISO, subMonths, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { SportChip } from "@/components/ui/SportChip";
import {
  Disclosure,
  DisclosureTrigger,
  DisclosureContent,
  useDisclosureContext,
} from "@/components/ui/Disclosure";
import { KpiCards } from "@/components/kpis/KpiCards";
import { KpiDetailDialog } from "@/components/kpis/KpiDetailDialog";
import { VolumeDistribution } from "@/components/charts/VolumeDistribution";
import { LoadEvolution } from "@/components/charts/LoadEvolution";
import { AcwrMetricCard } from "@/components/load/AcwrMetricCard";
import { WeeklyHeatmap } from "@/components/charts/WeeklyHeatmap";
import { FocusCoach } from "@/components/analysis/FocusCoach";
import { TextInsights } from "@/components/analysis/TextInsights";
import { HrZonesBilan } from "@/components/analysis/HrZonesBilan";
import { BilanPeriodToolbar } from "@/components/bilan/BilanPeriodToolbar";
import { useAuth } from "@/hooks/useAuth";
import { isCoach } from "@/lib/auth/roles";
import { useAthleteKpis } from "@/hooks/useAthleteKpis";
import { useExportBilan } from "@/hooks/useExportBilan";
import { useAcwr } from "@/hooks/useAcwr";
import { getAthleteById } from "@/repositories/athlete.repository";
import { getAthleteDailyLoadHistory } from "@/repositories/load.repository";
import { getDecouplingBadgeVariant } from "@/lib/karolyMetrics";
import { buildWeeklyHeatmapData, type WeeklyHeatmapData } from "@/services/load.service";
import { buildPeriodLabel, isCurrentPeriod as checkIsCurrentPeriod } from "@/services/stats.service";
import { buildHrvTimeline, buildHrvPdfSummary, type HrvPdfSummary } from "@/services/hrv.service";
import { getReadinessSeries } from "@/repositories/readiness.repository";
import { getSportConfig } from "@/lib/constants";
import type { AthleteDetailOutletContext } from "@/components/layout/AthleteDetailLayout";
import type { Athlete } from "@/types/athlete";
import type { KpiPeriod, KpiCard } from "@/services/stats.service";

interface AthleteBilanPageProps {
  athleteId?: string;
}

export function AthleteBilanPage({ athleteId: propAthleteId }: AthleteBilanPageProps = {}) {
  const { id: paramAthleteId } = useParams();
  const outletContext = useOutletContext<AthleteDetailOutletContext | null>();
  const [searchParams, setSearchParams] = useSearchParams();
  const athleteId = propAthleteId ?? paramAthleteId ?? null;
  const isAthleteMode = !!propAthleteId;
  const { role } = useAuth();
  const showCoachAcwr = isCoach(role) && !isAthleteMode && !!athleteId;

  // URL-driven period & anchor date
  const period: KpiPeriod = (searchParams.get("period") as KpiPeriod) || "week";
  const dateParam = searchParams.get("date");
  const anchorDate = useMemo(
    () => (dateParam ? parseISO(dateParam) : new Date()),
    [dateParam]
  );
  const isCurrent = checkIsCurrentPeriod(period, anchorDate);
  const periodTitle = buildPeriodLabel(period, anchorDate);

  const setPeriod = useCallback(
    (newPeriod: KpiPeriod) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("period", newPeriod);
        return next;
      });
    },
    [setSearchParams]
  );

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const delta = direction === "prev" ? -1 : 1;
      const newDate =
        period === "week"
          ? (delta > 0 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1))
          : (delta > 0 ? addMonths(anchorDate, 1) : subMonths(anchorDate, 1));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("date", format(newDate, "yyyy-MM-dd"));
        if (!next.has("period")) next.set("period", period);
        return next;
      });
    },
    [anchorDate, period, setSearchParams]
  );

  const handleTodayClick = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("date");
      return next;
    });
  }, [setSearchParams]);

  // Coach mode: athlete from layout outlet context; Athlete mode: fetch locally
  const [localAthlete, setLocalAthlete] = useState<Athlete | null>(null);
  const [localAthleteLoading, setLocalAthleteLoading] = useState(isAthleteMode);
  const athlete = isAthleteMode ? localAthlete : (outletContext?.athlete ?? null);
  const athleteLoading = isAthleteMode ? localAthleteLoading : false;

  const [weeklyHeatmapData, setWeeklyHeatmapData] = useState<WeeklyHeatmapData | null>(null);
  const [isWeeklyHeatmapLoading, setIsWeeklyHeatmapLoading] = useState(false);
  const [hrvSummary, setHrvSummary] = useState<HrvPdfSummary | null>(null);

  const [sportFilter, setSportFilter] = useState("TOUT");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeKpiKey, setActiveKpiKey] = useState<KpiCard["key"] | null>(null);
  const [coachComment, setCoachComment] = useState("");
  const { report, isLoading } = useAthleteKpis(athleteId, period, anchorDate, sportFilter);
  const { detail: acwrDetail, isLoading: acwrLoading } = useAcwr({ athleteId, enabled: !!athleteId });
  const { exportPdf, isExporting } = useExportBilan();

  useEffect(() => {
    if (!isAthleteMode || !athleteId) return;

    let cancelled = false;
    setLocalAthleteLoading(true);

    getAthleteById(athleteId)
      .then((data) => { if (!cancelled) setLocalAthlete(data); })
      .catch((error) => { console.error(error); if (!cancelled) setLocalAthlete(null); })
      .finally(() => { if (!cancelled) setLocalAthleteLoading(false); });

    return () => { cancelled = true; };
  }, [athleteId, isAthleteMode]);

  const anchorIso = format(anchorDate, "yyyy-MM-dd");
  const weekEndIso = format(endOfWeek(anchorDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

  useEffect(() => {
    let isCancelled = false;

    if (!athleteId) {
      setWeeklyHeatmapData(null);
      setIsWeeklyHeatmapLoading(false);
      return () => { isCancelled = true; };
    }

    setIsWeeklyHeatmapLoading(true);

    getAthleteDailyLoadHistory(athleteId, weekEndIso)
      .then((rows) => {
        if (isCancelled) return;
        setWeeklyHeatmapData(buildWeeklyHeatmapData(rows, anchorIso));
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
  }, [athleteId, anchorIso, weekEndIso]);

  // Load HRV summary for PDF export
  useEffect(() => {
    let cancelled = false;
    if (!athleteId) { setHrvSummary(null); return; }

    getReadinessSeries(athleteId, 35)
      .then((rows) => {
        if (cancelled) return;
        const timeline = buildHrvTimeline(rows);
        setHrvSummary(buildHrvPdfSummary(timeline));
      })
      .catch(() => { if (!cancelled) setHrvSummary(null); });

    return () => { cancelled = true; };
  }, [athleteId]);

  const handleKpiClick = useCallback((key: KpiCard["key"]) => {
    setActiveKpiKey(key);
  }, []);

  const handleKpiSportSelect = useCallback((sportKey: string) => {
    setSportFilter(sportKey);
    setActiveKpiKey(null);
  }, []);

  const sessionsListPath = isAthleteMode ? "/mon-espace/seances" : undefined;
  const activityBasePath = isAthleteMode ? "/mon-espace/activities" : "/activities";

  // Full spinner only on very first load (no data yet)
  if (athleteLoading || (isLoading && !report)) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {isAthleteMode ? "Mon bilan" : `Bilan · ${athleteName}`}
        </h1>

        <button
          disabled={isExporting || !report}
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent-orange px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-orange/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => setShowExportDialog(true)}
        >
          <Icon
            name={isExporting ? "progress_activity" : "download"}
            className={`text-[16px] ${isExporting ? "animate-spin" : ""}`}
          />
          {isExporting ? "Export..." : "Exporter PDF"}
        </button>

        <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)}>
          <DialogHeader>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Exporter le bilan PDF
            </h2>
          </DialogHeader>
          <DialogBody>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Commentaire coach
            </label>
            <textarea
              value={coachComment}
              onChange={(e) => setCoachComment(e.target.value)}
              placeholder="Ajoute ton feedback pour l'athlète (optionnel)..."
              rows={5}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Ce commentaire apparaîtra en haut du PDF, bien visible pour l'athlète.
            </p>
          </DialogBody>
          <DialogFooter>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowExportDialog(false)}>
                Annuler
              </Button>
              <Button
                disabled={isExporting}
                onClick={() => {
                  if (!report) return;
                  const acwrMetrics = acwrDetail
                    ? [acwrDetail.external, acwrDetail.internal, acwrDetail.global]
                    : undefined;
                  setShowExportDialog(false);
                  exportPdf(report, athleteName, acwrMetrics, coachComment.trim() || undefined, hrvSummary);
                }}
              >
                <Icon
                  name={isExporting ? "progress_activity" : "picture_as_pdf"}
                  className={`text-[16px] ${isExporting ? "animate-spin" : ""}`}
                />
                Générer le PDF
              </Button>
            </div>
          </DialogFooter>
        </Dialog>
      </div>

      <BilanPeriodToolbar
        period={period}
        periodTitle={periodTitle}
        rangeLabel={report.currentRangeLabel}
        comparisonLabel={report.comparisonRangeLabel}
        onPeriodChange={setPeriod}
        onNavigate={handleNavigate}
        onTodayClick={handleTodayClick}
        isCurrentPeriod={isCurrent}
      />

      {report.focusAlert && <FocusCoach alert={report.focusAlert} />}

      {/* ── Sport filter chips ── */}
      {report.availableSports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <SportChip
            label="Tous"
            isActive={sportFilter === "TOUT"}
            onClick={() => setSportFilter("TOUT")}
          />
          {report.availableSports.map((key) => {
            const config = getSportConfig(key);
            return (
              <SportChip
                key={key}
                label={config.label}
                icon={config.icon}
                isActive={sportFilter === key}
                onClick={() => setSportFilter(key)}
              />
            );
          })}
        </div>
      )}

      <KpiCards cards={report.cards} onCardClick={handleKpiClick} />

      <KpiDetailDialog
        open={activeKpiKey !== null}
        onClose={() => setActiveKpiKey(null)}
        cardKey={activeKpiKey}
        cards={report.cards}
        distribution={report.distribution}
        sportDecoupling={report.sportDecoupling}
        sessions={report.sessions}
        sportFilter={sportFilter}
        onSportSelect={handleKpiSportSelect}
        sessionsListPath={sessionsListPath}
        activityBasePath={activityBasePath}
      />

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
                  Répartition MLS de la {isCurrent ? "semaine en cours" : "semaine sélectionnée"}.
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
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
              <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${config.bgLight}`}>
                          <Icon name={config.icon} className={config.textColor} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
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

        <HrZonesBilan hrZones={report.hrZones} hrZonesBySport={report.hrZonesBySport} />
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
      <DisclosureTrigger className="group flex w-full items-center justify-between rounded-lg px-1 py-2 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/30">
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
