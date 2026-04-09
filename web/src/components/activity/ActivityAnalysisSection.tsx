import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Disclosure, DisclosureTrigger, DisclosureContent, useDisclosureContext } from "@/components/ui/Disclosure";
import { ZoneDistributionChart } from "@/components/charts/ZoneDistributionChart";
import { DecouplingVisual } from "@/components/charts/DecouplingVisual";
import { IntervalChart } from "@/components/charts/IntervalChart";
import { IntervalDetailTable, type ViewMode } from "@/components/tables/IntervalDetailTable";
import { TargetVsActualChart } from "@/components/charts/TargetVsActualChart";
import { TempoSegmentAnalysis } from "@/components/charts/TempoSegmentAnalysis";
import { TempoPhaseComparison } from "@/components/charts/TempoPhaseComparison";
import { FormAnalysisPanel } from "@/components/activity/FormAnalysisPanel";
import { SectionCoachComment } from "@/components/activity/SectionCoachComment";
import type { Activity, ActivityInterval, BlockGroupedIntervals, RepWindow, SectionCommentKey } from "@/types/activity";
import type { PhysioProfile } from "@/types/physio";
import { isTempo } from "@/services/activity.service";

interface Props {
  activity: Activity;
  intervals: ActivityInterval[];
  intervalsByBlock: BlockGroupedIntervals[];
  repWindowsByBlock: Record<number, RepWindow[]>;
  hasManualWindows?: boolean;
  physioProfile: PhysioProfile | null;
  expandedBlocks?: Set<number>;
  onToggleBlock?: (blockIndex: number) => void;
  onAnalysisHighlightsChange?: (highlights: AnalysisHighlightRange[]) => void;
  isCoach?: boolean;
  sectionComments?: Record<string, string> | null;
  onSaveSectionComment?: (sectionKey: string, comment: string) => Promise<void>;
}

const COMPETITION_LABELS = ["Q1 (Départ)", "Q2 (Mise en place)", "Q3 (Gestion)", "Q4 (Finish)"];

export interface AnalysisHighlightRange {
  startSec: number;
  endSec: number;
}

export function buildAnalysisHighlights(
  intervalsByBlock: BlockGroupedIntervals[],
  repWindowsByBlock: Record<number, RepWindow[]>,
  expandedBlocks: Set<number>,
  viewMode: ViewMode,
): AnalysisHighlightRange[] {
  return intervalsByBlock
    .filter((group) => expandedBlocks.has(group.blockIndex))
    .flatMap((group) => {
      if (viewMode === "windows") {
        return (repWindowsByBlock[group.blockIndex] ?? [])
          .flatMap((window) => (
            window.start_sec != null && window.end_sec != null
              ? [{ startSec: window.start_sec, endSec: window.end_sec }]
              : []
          ));
      }

      return group.intervals
        .filter((interval) => (interval.type === "work" || interval.type === "active") && interval.start_time != null && interval.end_time != null)
        .map((interval) => ({ startSec: interval.start_time, endSec: interval.end_time }));
    });
}

export function ActivityAnalysisSection({
  activity,
  intervals,
  intervalsByBlock,
  repWindowsByBlock,
  hasManualWindows,
  physioProfile,
  expandedBlocks,
  onToggleBlock,
  onAnalysisHighlightsChange,
  isCoach,
  sectionComments,
  onSaveSectionComment,
}: Props) {
  const segmented = activity.segmented_metrics;
  const formAnalysis = activity.form_analysis ?? null;
  const hasStreams = Boolean(activity.activity_streams?.length);
  const workType = activity.work_type;
  const isTempoActivity = isTempo(activity.manual_activity_name || activity.activity_name);

  useEffect(() => {
    if (workType !== "intervals") onAnalysisHighlightsChange?.([]);
  }, [workType, onAnalysisHighlightsChange]);

  // Competition: check for positive/negative split alert
  const competitionSplitAlert = (() => {
    if (workType !== "competition") return null;
    const splits4 = segmented?.splits_4;
    if (!splits4) return null;
    const q1 = splits4.phase_1;
    const q4 = splits4.phase_4;
    if (!q1?.speed || !q4?.speed) return null;
    const drift = ((q4.speed - q1.speed) / q1.speed) * 100;
    if (drift < -3) return { type: "positive" as const, drift };   // started fast, slowed down
    if (drift > 3) return { type: "negative" as const, drift };   // started slow, sped up
    return null;
  })();

  const renderComment = (key: SectionCommentKey) =>
    onSaveSectionComment ? (
      <SectionCoachComment
        sectionKey={key}
        comment={sectionComments?.[key]}
        isCoach={isCoach ?? false}
        onSave={onSaveSectionComment}
      />
    ) : null;

  return (
    <Card>
      <Disclosure defaultOpen={false}>
        <DisclosureTrigger className="w-full border-b border-slate-200 px-6 py-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 transition-all duration-150">
          <AnalysisTriggerContent />
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="space-y-5 px-6 pt-2 pb-6">
            {formAnalysis ? (
              <>
                <FormAnalysisPanel activity={activity} formAnalysis={formAnalysis} />
                {renderComment("form_analysis")}
              </>
            ) : null}

            {/* Zone Distribution — always shown if streams + physio */}
            {hasStreams && (
              <CollapsibleSection title="Distribution zones FC">
                <ZoneDistributionChart
                  streams={activity.activity_streams!}
                  lt1Hr={physioProfile?.lt1_hr ?? null}
                  lt2Hr={physioProfile?.lt2_hr ?? null}
                  hideTitle
                />
                {renderComment("zone_distribution")}
              </CollapsibleSection>
            )}

            {/* Endurance: Decoupling */}
            {workType === "endurance" && (
              <CollapsibleSection title="Découplage aérobie">
                <DecouplingVisual
                  splits2={segmented?.splits_2}
                  decouplingIndex={activity.decoupling_index}
                  durabilityIndex={activity.durability_index}
                  sportType={activity.sport_type}
                  hideTitle
                />
                {renderComment("decoupling")}
              </CollapsibleSection>
            )}

            {/* Intervals: enriched analysis */}
            {workType === "intervals" && (
              <IntervalsSection
                intervals={intervals}
                intervalsByBlock={intervalsByBlock}
                repWindowsByBlock={repWindowsByBlock}
                hasManualWindows={hasManualWindows}
                physioProfile={physioProfile}
                activity={activity}
                segmented={segmented}
                expandedBlocks={expandedBlocks}
                onToggleBlock={onToggleBlock}
                onAnalysisHighlightsChange={onAnalysisHighlightsChange}
                renderSectionComment={renderComment}
              />
            )}

            {/* Tempo: 4-segment analysis + half comparison side by side */}
            {isTempoActivity && workType !== "competition" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CollapsibleSection title="Analyse par segments">
                  <TempoSegmentAnalysis
                    splits4={segmented?.splits_4}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                  {renderComment("segment_analysis")}
                </CollapsibleSection>
                <CollapsibleSection title="Comparaison 1re vs 2e moitié">
                  <TempoPhaseComparison
                    splits2={segmented?.splits_2}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                  {renderComment("phase_comparison")}
                </CollapsibleSection>
              </div>
            )}

            {/* Competition: 4-segment with competition labels + 1re/2e moitié + decoupling */}
            {workType === "competition" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <CollapsibleSection title="Analyse par segments">
                    <TempoSegmentAnalysis
                      splits4={segmented?.splits_4}
                      sportType={activity.sport_type}
                      phaseLabels={COMPETITION_LABELS}
                      hideTitle
                    />
                    {renderComment("segment_analysis")}
                  </CollapsibleSection>
                  <CollapsibleSection title="Comparaison 1re vs 2e moitié">
                    <TempoPhaseComparison
                      splits2={segmented?.splits_2}
                      sportType={activity.sport_type}
                      hideTitle
                    />
                    {renderComment("phase_comparison")}
                  </CollapsibleSection>
                </div>
                <CollapsibleSection title="Découplage aérobie">
                  <div className="flex flex-wrap items-stretch gap-3">
                    <DecouplingVisual
                      splits2={segmented?.splits_2}
                      decouplingIndex={activity.decoupling_index}
                      durabilityIndex={activity.durability_index}
                      sportType={activity.sport_type}
                      hideTitle
                    />
                    {competitionSplitAlert && (
                      <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 ${
                        competitionSplitAlert.type === "positive"
                          ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20"
                          : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20"
                      }`}>
                        <Icon
                          name={competitionSplitAlert.type === "positive" ? "trending_down" : "trending_up"}
                          className={`mt-0.5 ${
                            competitionSplitAlert.type === "positive"
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        />
                        <p className={`text-xs ${
                          competitionSplitAlert.type === "positive"
                            ? "text-red-700 dark:text-red-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}>
                          {competitionSplitAlert.type === "positive"
                            ? `Positive split : l'allure a diminué de ${Math.abs(competitionSplitAlert.drift).toFixed(1)}% entre Q1 et Q4.`
                            : `Negative split : l'allure a augmenté de ${competitionSplitAlert.drift.toFixed(1)}% entre Q1 et Q4.`}
                        </p>
                      </div>
                    )}
                  </div>
                  {renderComment("decoupling")}
                </CollapsibleSection>
                <FeatureNotice
                  title="Module 4 — Race Analysis"
                  description="Analyse avancée de course (transitions T1/T2, comparaison multi-courses) disponible en LOT 2."
                  status="unavailable"
                />
              </div>
            )}

            {!formAnalysis && (
              <FeatureNotice
                title="SOT non disponible"
                description="Les analyses de forme avancées sont en attente de `form_analysis`."
                status="partial"
              />
            )}

            <FeatureNotice
              title="Cartographie GPS — Module 6 (LOT 2)"
              description="Visualisation du parcours GPS avec heatmap de métriques. Disponible dans une prochaine version."
              status="unavailable"
            />
          </div>
        </DisclosureContent>
      </Disclosure>
    </Card>
  );
}

/** Sub-component: intervals section with block selector */
function IntervalsSection({
  intervals,
  intervalsByBlock,
  repWindowsByBlock,
  hasManualWindows,
  physioProfile,
  activity,
  segmented,
  expandedBlocks,
  onToggleBlock,
  onAnalysisHighlightsChange,
  renderSectionComment,
}: {
  intervals: ActivityInterval[];
  intervalsByBlock: BlockGroupedIntervals[];
  repWindowsByBlock: Record<number, RepWindow[]>;
  hasManualWindows?: boolean;
  physioProfile: PhysioProfile | null;
  activity: Activity;
  segmented: Activity["segmented_metrics"];
  expandedBlocks?: Set<number>;
  onToggleBlock?: (blockIndex: number) => void;
  onAnalysisHighlightsChange?: (highlights: AnalysisHighlightRange[]) => void;
  renderSectionComment?: (key: SectionCommentKey) => React.ReactNode;
}) {
  const [selectedBlock, setSelectedBlock] = useState<number | "all">("all");
  const [detailViewMode, setDetailViewMode] = useState<ViewMode>("intervals");
  const showSelector = intervalsByBlock.length > 1;

  const filteredByBlock = selectedBlock === "all"
    ? intervalsByBlock
    : intervalsByBlock.filter((g) => g.blockIndex === selectedBlock);

  const filteredRepWindows = selectedBlock === "all"
    ? repWindowsByBlock
    : { [selectedBlock as number]: repWindowsByBlock[selectedBlock as number] ?? [] };

  const filteredFlatIntervals = selectedBlock === "all"
    ? intervals
    : filteredByBlock.flatMap((g) => g.intervals);

  const filteredPlannedBlocks = selectedBlock === "all"
    ? segmented?.planned_interval_blocks
    : segmented?.planned_interval_blocks?.filter((b) => b.block_index === selectedBlock);

  const activeExpandedBlocks = expandedBlocks ?? new Set<number>();
  const analysisHighlights = useMemo(
    () => buildAnalysisHighlights(filteredByBlock, filteredRepWindows, activeExpandedBlocks, detailViewMode),
    [filteredByBlock, filteredRepWindows, activeExpandedBlocks, detailViewMode]
  );

  useEffect(() => {
    onAnalysisHighlightsChange?.(analysisHighlights);
  }, [analysisHighlights, onAnalysisHighlightsChange]);

  useEffect(() => {
    return () => onAnalysisHighlightsChange?.([]);
  }, [onAnalysisHighlightsChange]);

  return (
    <div className="space-y-4">
      {intervals.some((i) => i.detection_source === "manual") && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-800/50 dark:bg-orange-900/20">
          <Icon name="tune" className="text-orange-600 dark:text-orange-400" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            Affichage basé sur la détection manuelle.
          </p>
        </div>
      )}

      {showSelector && (
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setSelectedBlock("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              selectedBlock === "all"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Tous
          </button>
          {intervalsByBlock.map((g) => (
            <button
              key={g.blockIndex}
              type="button"
              onClick={() => setSelectedBlock(g.blockIndex)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                selectedBlock === g.blockIndex
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Bloc {g.blockIndex}
            </button>
          ))}
        </div>
      )}

      {selectedBlock !== "all" && filteredByBlock.every((g) => g.intervals.length === 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800/50 dark:bg-blue-900/20">
          <Icon name="info" className="text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Pas de données individuelles pour ce bloc. Utilisez la détection manuelle pour injecter les intervalles.
          </p>
        </div>
      )}

      <CollapsibleSection title={detailViewMode === "windows" ? "Évolution par fenêtre stabilisée" : "Évolution par intervalle"}>
        <IntervalChart
          intervalsByBlock={filteredByBlock}
          repWindowsByBlock={filteredRepWindows}
          viewMode={detailViewMode}
          physioProfile={physioProfile}
          sportType={activity.sport_type}
          hideTitle
        />
        {renderSectionComment?.("intervals_chart")}
      </CollapsibleSection>
      <IntervalDetailTable
        intervalsByBlock={filteredByBlock}
        sportType={activity.sport_type}
        repWindowsByBlock={filteredRepWindows}
        hasManualWindows={hasManualWindows}
        expandedBlocks={expandedBlocks}
        onToggleBlock={onToggleBlock}
        view={detailViewMode}
        onViewChange={setDetailViewMode}
      />
      {renderSectionComment?.("intervals_detail")}
      <CollapsibleSection title="Prévu vs Réalisé">
        <TargetVsActualChart
          intervalsByBlock={filteredByBlock}
          plannedBlocks={filteredPlannedBlocks}
          sportType={activity.sport_type}
          hideTitle
        />
        {renderSectionComment?.("target_vs_actual")}
      </CollapsibleSection>
      <IntervalAlerts intervals={filteredFlatIntervals} />
    </div>
  );
}

/** Sub-component: trigger header with animated chevron */
function AnalysisTriggerContent() {
  const { isOpen } = useDisclosureContext();
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
        <Icon name="analytics" className="text-blue-600 dark:text-blue-400" />
        Analyse approfondie
      </h2>
      <Icon
        name="expand_more"
        className={`text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
      />
    </div>
  );
}

/** Sub-component: collapsible wrapper for charts/tables */
function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Disclosure defaultOpen={true}>
        <DisclosureTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-50/60 px-3 py-2.5 hover:bg-slate-100/60 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 transition-all duration-150">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <SectionChevron />
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="pt-3">{children}</div>
        </DisclosureContent>
      </Disclosure>
    </div>
  );
}

function SectionChevron() {
  const { isOpen } = useDisclosureContext();
  return (
    <Icon
      name="expand_more"
      className={`text-slate-400 text-[18px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
    />
  );
}

/** Sub-component: interval-specific alerts */
function IntervalAlerts({ intervals }: { intervals: ActivityInterval[] }) {
  const active = intervals.filter((i) => i.type === "work" || i.type === "active");
  if (active.length < 4) return null;

  // Check degradation: last 2 vs first 2 intervals
  const first2Hr = active.slice(0, 2).reduce((sum, i) => sum + (i.avg_hr ?? 0), 0) / 2;
  const last2Hr = active.slice(-2).reduce((sum, i) => sum + (i.avg_hr ?? 0), 0) / 2;
  const first2Speed = active.slice(0, 2).reduce((sum, i) => sum + (i.avg_speed ?? 0), 0) / 2;
  const last2Speed = active.slice(-2).reduce((sum, i) => sum + (i.avg_speed ?? 0), 0) / 2;

  if (!first2Hr || !last2Hr) return null;

  const hrDrift = ((last2Hr - first2Hr) / first2Hr) * 100;
  const speedDrift = first2Speed ? ((last2Speed - first2Speed) / first2Speed) * 100 : 0;

  if (hrDrift <= 5 || Math.abs(speedDrift) >= 3) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
      <Icon name="warning" className="mt-0.5 text-amber-600 dark:text-amber-400" />
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Dégradation détectée : FC en hausse de {hrDrift.toFixed(1)}% sur les 2 derniers intervalles
        par rapport aux 2 premiers, avec allure stable.
      </p>
    </div>
  );
}
