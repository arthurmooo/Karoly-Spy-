import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { ActivityStreamChart } from "@/components/charts/ActivityStreamChart";
import { ManualIntervalDetector } from "@/components/intervals/ManualIntervalDetector";
import { LapsTable } from "@/components/tables/LapsTable";
import { ActivityHeader } from "@/components/activity/ActivityHeader";
import { ActivityKpiCards } from "@/components/activity/ActivityKpiCards";
import { ActivityAnalysisSection } from "@/components/activity/ActivityAnalysisSection";
import { AthleteFeedbackPanel } from "@/components/activity/AthleteFeedbackPanel";
import { CoachFeedbackPanel } from "@/components/activity/CoachFeedbackPanel";
import { IntervalBlocksCard } from "@/components/activity/IntervalBlocksCard";
import { useActivityDetail } from "@/hooks/useActivityDetail";
import { useAuth } from "@/hooks/useAuth";
import { isCoach as checkIsCoach } from "@/lib/auth/roles";
import { useAthletePhysioProfile } from "@/hooks/useAthletePhysioProfile";
import { hasManualBlockOverride } from "@/services/manualIntervals.service";
import type { DetectedSegment, ManualBlockOverridePayload } from "@/services/manualIntervals.service";
import { formatPaceDecimal } from "@/services/format.service";
import {
  getChartMaxSec,
  buildResolvedBlocks,
  buildBlocksFromIntervals,
  mergeActivityWithPayload,
  getManualBlockFingerprint,
  readStoredManualSegments,
  writeStoredManualSegments,
  computeEffectiveIntervals,
  computeBlockGroupedIntervals,
} from "@/lib/activityBlocks";
import { computeFrontendRepWindows } from "@/services/repWindows.service";
import type { RepWindow } from "@/types/activity";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

export function ActivityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const isCoach = checkIsCoach(role);

  const {
    activity, intervals, isLoading, isLoadingStreams,
    isSaving, saveError, nolioSynced, saveCoachComment,
    saveManualDetectorOverride, handleReprocess, isReprocessing,
    saveWorkType, isSavingWorkType, workTypeSaveError, workTypeWarning,
    isSavingFeedback, feedbackSaveError, saveAthleteFeedback,
  } = useActivityDetail(id);

  const { profile: physioProfile } = useAthletePhysioProfile(
    activity?.athlete_id, activity?.session_date, activity?.sport_type
  );

  const [highlightedSegments, setHighlightedSegments] = useState<DetectedSegment[]>([]);
  const [manualBlockSegmentsByBlock, setManualBlockSegmentsByBlock] = useState<Partial<Record<1 | 2, DetectedSegment[]>>>({});
  const [reprocessLaunched, setReprocessLaunched] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  useEffect(() => { setHighlightedSegments([]); setExpandedBlocks(new Set()); }, [activity?.id]);

  // Restore manual segments from localStorage
  useEffect(() => {
    if (!activity?.id) { setManualBlockSegmentsByBlock({}); return; }
    const allStored = readStoredManualSegments();
    const stored = allStored[activity.id] ?? {};
    const next: Partial<Record<1 | 2, DetectedSegment[]>> = {};
    let changed = false;
    for (const bi of [1, 2] as const) {
      const entry = stored[String(bi) as "1" | "2"];
      if (!entry) continue;
      const fp = getManualBlockFingerprint(activity, bi);
      if (fp && hasManualBlockOverride(activity, bi) && entry.fingerprint === fp) { next[bi] = entry.segments; continue; }
      delete stored[String(bi) as "1" | "2"];
      changed = true;
    }
    if (Object.keys(stored).length === 0 && allStored[activity.id]) { delete allStored[activity.id]; changed = true; }
    if (changed) writeStoredManualSegments(allStored);
    setManualBlockSegmentsByBlock(next);
  }, [activity]);

  // ── Derived state ───────────────────────────────────────

  const segmentedMetrics = activity?.segmented_metrics ?? null;
  const chartMaxSec = activity ? getChartMaxSec(activity) : 0;
  const resolvedBlocks = activity
    ? buildResolvedBlocks(activity, segmentedMetrics?.interval_blocks, intervals, manualBlockSegmentsByBlock, chartMaxSec)
    : [];
  const fallbackBlocks = buildBlocksFromIntervals(intervals);
  const displayBlocks = resolvedBlocks.length > 0 ? resolvedBlocks : fallbackBlocks;
  const hasResolvedBlocks = resolvedBlocks.length > 0;
  const effectiveIntervals = activity
    ? computeEffectiveIntervals(intervals, manualBlockSegmentsByBlock, activity.id)
    : intervals;

  const blockGroupedIntervals = useMemo(
    () =>
      activity?.id
        ? computeBlockGroupedIntervals(intervals, manualBlockSegmentsByBlock, segmentedMetrics?.interval_blocks, activity.id, activity)
        : [],
    [intervals, manualBlockSegmentsByBlock, segmentedMetrics?.interval_blocks, activity]
  );

  const hasManualWindows = blockGroupedIntervals.some(
    (g) => g.intervals.some((i) => i.detection_source === "manual")
  );

  const repWindowsByBlock = useMemo(() => {
    if (!activity) return {};

    const result: Record<number, RepWindow[]> = {};
    const backendWindows = activity.form_analysis?.rep_windows;
    let cumIdx = 0;
    for (const group of blockGroupedIntervals) {
      const workCount = group.intervals.filter((i) => i.type === "work" || i.type === "active").length;
      const isManual = group.intervals.some((i) => i.detection_source === "manual");
      if (isManual && activity.activity_streams?.length) {
        result[group.blockIndex] = computeFrontendRepWindows(
          group.intervals, activity.activity_streams, activity.sport_type ?? "",
        );
      } else if (backendWindows?.length) {
        result[group.blockIndex] = backendWindows.filter(
          (w) => w.rep_index >= cumIdx + 1 && w.rep_index <= cumIdx + workCount
        );
      }
      cumIdx += workCount;
    }
    return result;
  }, [blockGroupedIntervals, activity]);

  const isBike = BIKE_SPORTS.has(activity?.sport_type ?? "");
  const hasStreams = Boolean(activity?.activity_streams?.length);
  const hasLaps = Boolean(activity?.garmin_laps?.length);
  const hasFitFile = Boolean(activity?.fit_file_path);
  const hasDerivedAnalysisPending = Boolean(activity?.analysis_dirty);

  const handleToggleBlock = (blockIndex: number) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockIndex)) next.delete(blockIndex); else next.add(blockIndex);
      return next;
    });
  };

  const blockHighlights = blockGroupedIntervals
    .filter((g) => expandedBlocks.has(g.blockIndex))
    .flatMap((g) => g.intervals
      .filter((i) => (i.type === "work" || i.type === "active") && i.start_time != null && i.end_time != null)
      .map((i) => ({ startSec: i.start_time, endSec: i.end_time }))
    );

  const chartData = displayBlocks.map((block, i) => ({
    index: i + 1, label: block.label,
    hr: block.hrMean != null ? Math.round(block.hrMean) : null,
    pace: block.paceMean,
    power: block.powerMean != null ? Math.round(block.powerMean) : null,
  }));

  const handleInjectedSegmentsChange = (blockIndex: 1 | 2, segments: DetectedSegment[] | null, payload: ManualBlockOverridePayload) => {
    if (!activity?.id) return;
    const merged = mergeActivityWithPayload(activity, payload);
    const fp = getManualBlockFingerprint(merged, blockIndex);
    setManualBlockSegmentsByBlock((prev) => {
      const next = { ...prev };
      if (segments?.length && fp) next[blockIndex] = segments; else delete next[blockIndex];
      return next;
    });
    const allStored = readStoredManualSegments();
    const stored = { ...(allStored[activity.id] ?? {}) };
    const key = String(blockIndex) as "1" | "2";
    if (segments?.length && fp) { stored[key] = { fingerprint: fp, segments }; allStored[activity.id] = stored; }
    else { delete stored[key]; if (!Object.keys(stored).length) delete allStored[activity.id]; else allStored[activity.id] = stored; }
    writeStoredManualSegments(allStored);
  };

  // ── Loading / Not Found ─────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="space-y-8">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary">
          <Icon name="arrow_back" className="text-lg" />
          Retour aux activités
        </button>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Icon name="search_off" className="text-4xl text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Activité introuvable</p>
        </div>
      </div>
    );
  }

  const feedbackPanels = (
    <>
      <AthleteFeedbackPanel
        activity={activity}
        isCoach={isCoach}
        isSaving={isSavingFeedback}
        saveError={feedbackSaveError}
        onSaveFeedback={saveAthleteFeedback}
      />
      <CoachFeedbackPanel
        activity={activity}
        isCoach={isCoach}
        isSaving={isSaving}
        saveError={saveError}
        nolioSynced={nolioSynced}
        onSaveComment={saveCoachComment}
      />
    </>
  );

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 lg:space-y-8">
      <ActivityHeader
        activity={activity}
        onBack={() => navigate(-1)}
        onOpenComparison={() => navigate(`${location.pathname}/compare`)}
        onReprocess={handleReprocess}
        onSaveWorkType={async (manualWorkType) => {
          const result = await saveWorkType(manualWorkType);
          if (result.success) {
            if (result.reprocessDispatched) {
              toast.success("Type de séance mis à jour. Recalcul lancé.");
            } else if (result.warning) {
              toast.warning(result.warning);
            } else {
              toast.success("Type de séance mis à jour.");
            }
          } else if (result.error) {
            toast.error(result.error);
          }
          return result;
        }}
        isReprocessing={isReprocessing}
        reprocessLaunched={reprocessLaunched}
        onReprocessLaunched={() => { toast.success("Recalcul lancé"); setReprocessLaunched(true); }}
        isSavingWorkType={isSavingWorkType}
        workTypeSaveError={workTypeSaveError}
        workTypeWarning={workTypeWarning}
        isCoach={isCoach}
      />

      {hasDerivedAnalysisPending && (
        <FeatureNotice
          title="Analyses en cours de recalcul"
          description="Le type de séance a changé. Les modules dérivés restent masqués jusqu'à la fin du recalcul backend."
          status="partial"
        />
      )}

      <div className="space-y-6 lg:hidden">
        {feedbackPanels}
      </div>

      <ActivityKpiCards activity={activity} />

      {/* Stream Chart */}
      <Card>
        <CardContent className="space-y-5 p-6">
          {isLoadingStreams ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <Icon name="show_chart" className="text-slate-400" />
                  Analyse de la performance
                </h2>
                <Badge variant="amber">Chargement...</Badge>
              </div>
              <div className="flex h-[300px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-slate-500">Chargement des courbes FIT...</p>
                </div>
              </div>
            </>
          ) : hasStreams ? (
            <ActivityStreamChart
              streams={activity.activity_streams!}
              laps={activity.garmin_laps}
              sportType={activity.sport_type}
              highlightedSegments={highlightedSegments}
              blockHighlights={blockHighlights}
              renderHeader={(toggles) => (
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                      <Icon name="show_chart" className="text-slate-400" />
                      Analyse de la performance
                    </h2>
                    {toggles}
                  </div>
                  <Badge variant="emerald">Courbe continue</Badge>
                </div>
              )}
            />
          ) : displayBlocks.length > 0 && !hasDerivedAnalysisPending ? (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <Icon name="show_chart" className="text-slate-400" />
                  Analyse de la performance
                </h2>
                <Badge variant={hasResolvedBlocks ? "emerald" : "amber"}>
                  {hasResolvedBlocks ? "Parité Retool" : "Fallback intervalles"}
                </Badge>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="index" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" reversed={!isBike} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(value: number, name: string) => {
                        if (name === "hr") return [`${value} bpm`, "FC"];
                        if (name === "pace") return [formatPaceDecimal(value), "Allure bloc"];
                        if (name === "power") return [`${value} W`, "Puissance bloc"];
                        return [value, name];
                      }}
                      labelFormatter={(l) => `Bloc ${l}`}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="hr" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line yAxisId="right" type="stepAfter" dataKey={isBike ? "power" : "pace"} stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : hasDerivedAnalysisPending ? (
            <FeatureNotice
              title="Courbe détaillée en attente"
              description="La courbe FIT reste prioritaire. Les blocs dérivés ne seront réutilisés qu'après le recalcul du nouveau type de séance."
              status="partial"
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <Icon name="show_chart" className="text-slate-400" />
                  Analyse de la performance
                </h2>
                <Badge variant="amber">Aucune donnée</Badge>
              </div>
              <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <Icon name="bar_chart" className="text-3xl" />
                  Pas de blocs ou d'intervalles exploitables
                </div>
              </div>
            </>
          )}
          {!hasStreams && !isLoadingStreams && !hasFitFile && (
            <FeatureNotice title="Courbe FIT point à point" description="Aucun FIT stocké pour cette séance." status="backend" />
          )}
        </CardContent>
      </Card>

      {/* Advanced Analysis (zones, decoupling, intervals, tempo, competition, GPS placeholder) */}
      {hasDerivedAnalysisPending ? (
        <FeatureNotice
          title="Analyse approfondie temporairement indisponible"
          description="Les analyses de découplage, de blocs et de forme seront réaffichées dès que le recalcul aura terminé."
          status="partial"
        />
      ) : (
        <ActivityAnalysisSection
          activity={activity}
          intervals={effectiveIntervals}
          intervalsByBlock={blockGroupedIntervals}
          repWindowsByBlock={repWindowsByBlock}
          hasManualWindows={hasManualWindows}
          physioProfile={physioProfile}
          expandedBlocks={expandedBlocks}
          onToggleBlock={handleToggleBlock}
        />
      )}

      {/* Bottom grid: blocks table + sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {hasDerivedAnalysisPending ? (
            <FeatureNotice
              title="Blocs d'intervalles masqués"
              description="Les blocs et métriques de répétitions seront remis à jour après le recalcul du nouveau type de séance."
              status="partial"
            />
          ) : (
            <IntervalBlocksCard
              displayBlocks={displayBlocks}
              isBike={isBike}
              hasResolvedBlocks={hasResolvedBlocks}
              detectionSource={activity.interval_detection_source}
            />
          )}
          {hasLaps && (
            <Card>
              <CardContent className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                    <Icon name="timer" className="text-slate-400" />
                    Laps montres
                  </h2>
                  <Badge variant="emerald">{activity.garmin_laps!.length} laps</Badge>
                </div>
                <LapsTable laps={activity.garmin_laps!} sportType={activity.sport_type} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {isCoach && (
            <div>
              {hasDerivedAnalysisPending ? (
                <FeatureNotice
                  title="Détecteur manuel désactivé"
                  description="Le détecteur manuel sera réactivé dès que les analyses du nouveau type de séance seront recalculées."
                  status="partial"
                />
              ) : !hasStreams && !isLoadingStreams ? (
                <FeatureNotice title="Streams requis" description="Le détecteur manuel nécessite les streams FIT." status="backend" />
              ) : (
                <ManualIntervalDetector
                  activity={activity}
                  isLoadingStreams={isLoadingStreams}
                  onSave={saveManualDetectorOverride}
                  onDetectedSegmentsChange={setHighlightedSegments}
                  onInjectedSegmentsChange={handleInjectedSegmentsChange}
                />
              )}
            </div>
          )}
          <div className="hidden space-y-6 lg:block">
            {feedbackPanels}
          </div>
        </div>
      </div>

    </div>
  );
}
