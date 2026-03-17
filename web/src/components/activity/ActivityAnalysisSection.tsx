import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Disclosure, DisclosureTrigger, DisclosureContent, useDisclosureContext } from "@/components/ui/Disclosure";
import { ZoneDistributionChart } from "@/components/charts/ZoneDistributionChart";
import { DecouplingVisual } from "@/components/charts/DecouplingVisual";
import { IntervalChart } from "@/components/charts/IntervalChart";
import { IntervalDetailTable } from "@/components/tables/IntervalDetailTable";
import { TargetVsActualChart } from "@/components/charts/TargetVsActualChart";
import { TempoSegmentAnalysis } from "@/components/charts/TempoSegmentAnalysis";
import { TempoPhaseComparison } from "@/components/charts/TempoPhaseComparison";
import { FormAnalysisPanel } from "@/components/activity/FormAnalysisPanel";
import type { Activity, ActivityInterval } from "@/types/activity";
import type { PhysioProfile } from "@/types/physio";
import { isTempo } from "@/services/activity.service";

interface Props {
  activity: Activity;
  intervals: ActivityInterval[];
  physioProfile: PhysioProfile | null;
}

const COMPETITION_LABELS = ["Q1 (Départ)", "Q2 (Mise en place)", "Q3 (Gestion)", "Q4 (Finish)"];

export function ActivityAnalysisSection({ activity, intervals, physioProfile }: Props) {
  const segmented = activity.segmented_metrics;
  const formAnalysis = activity.form_analysis ?? null;
  const hasStreams = Boolean(activity.activity_streams?.length);
  const workType = activity.work_type;
  const isTempoActivity = isTempo(activity.manual_activity_name || activity.activity_name);

  // Competition: check for positive/negative split alert
  const competitionSplitAlert = (() => {
    if (workType !== "competition") return null;
    const splits4 = segmented?.splits_4;
    if (!splits4) return null;
    const q1 = splits4.phase_1;
    const q4 = splits4.phase_4;
    if (!q1?.speed || !q4?.speed) return null;
    const drift = ((q4.speed - q1.speed) / q1.speed) * 100;
    if (drift < -3) return { type: "negative" as const, drift };
    if (drift > 3) return { type: "positive" as const, drift };
    return null;
  })();

  return (
    <Card>
      <Disclosure defaultOpen={false}>
        <DisclosureTrigger className="rounded-t-lg p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <AnalysisTriggerContent />
        </DisclosureTrigger>
        <DisclosureContent>
          <div className="space-y-6 px-6 pb-6">
            {formAnalysis ? <FormAnalysisPanel formAnalysis={formAnalysis} /> : null}

            {/* Zone Distribution — always shown if streams + physio */}
            {hasStreams && (
              <CollapsibleSection title="Distribution zones FC">
                <ZoneDistributionChart
                  streams={activity.activity_streams!}
                  lt1Hr={physioProfile?.lt1_hr ?? null}
                  lt2Hr={physioProfile?.lt2_hr ?? null}
                  hideTitle
                />
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
              </CollapsibleSection>
            )}

            {/* Intervals: enriched analysis */}
            {workType === "intervals" && (
              <div className="space-y-4">
                <CollapsibleSection title="Évolution par intervalle">
                  <IntervalChart
                    intervals={intervals}
                    physioProfile={physioProfile}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                </CollapsibleSection>
                <IntervalDetailTable
                  intervals={intervals}
                  sportType={activity.sport_type}
                  repWindows={formAnalysis?.rep_windows}
                />
                <CollapsibleSection title="Prévu vs Réalisé">
                  <TargetVsActualChart
                    intervals={intervals}
                    blocks={segmented?.interval_blocks}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                </CollapsibleSection>
                <IntervalAlerts intervals={intervals} />
              </div>
            )}

            {/* Tempo: 4-segment analysis */}
            {isTempoActivity && workType !== "competition" && (
              <div className="space-y-4">
                <CollapsibleSection title="Analyse par segments">
                  <TempoSegmentAnalysis
                    splits4={segmented?.splits_4}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Comparaison 1re vs 2e moitié">
                  <TempoPhaseComparison
                    splits2={segmented?.splits_2}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                </CollapsibleSection>
              </div>
            )}

            {/* Competition: 4-segment with competition labels + decoupling */}
            {workType === "competition" && (
              <div className="space-y-4">
                <CollapsibleSection title="Analyse par segments">
                  <TempoSegmentAnalysis
                    splits4={segmented?.splits_4}
                    sportType={activity.sport_type}
                    phaseLabels={COMPETITION_LABELS}
                    hideTitle
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Découplage aérobie">
                  <DecouplingVisual
                    splits2={segmented?.splits_2}
                    decouplingIndex={activity.decoupling_index}
                    durabilityIndex={activity.durability_index}
                    sportType={activity.sport_type}
                    hideTitle
                  />
                </CollapsibleSection>
                {competitionSplitAlert && (
                  <div className={`flex items-start gap-2 rounded-sm border px-3 py-2 ${
                    competitionSplitAlert.type === "negative"
                      ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20"
                      : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20"
                  }`}>
                    <Icon
                      name={competitionSplitAlert.type === "negative" ? "trending_down" : "trending_up"}
                      className={`mt-0.5 ${
                        competitionSplitAlert.type === "negative"
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    />
                    <p className={`text-xs ${
                      competitionSplitAlert.type === "negative"
                        ? "text-red-700 dark:text-red-300"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {competitionSplitAlert.type === "negative"
                        ? `Negative split : l'allure a diminué de ${Math.abs(competitionSplitAlert.drift).toFixed(1)}% entre Q1 et Q4.`
                        : `Positive split : l'allure a augmenté de ${competitionSplitAlert.drift.toFixed(1)}% entre Q1 et Q4.`}
                    </p>
                  </div>
                )}
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

/** Sub-component: trigger header with animated chevron */
function AnalysisTriggerContent() {
  const { isOpen } = useDisclosureContext();
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
        <Icon name="analytics" className="text-slate-400" />
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
    <Disclosure defaultOpen={false}>
      <DisclosureTrigger className="flex w-full items-center justify-between rounded-sm px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
        <SectionChevron />
      </DisclosureTrigger>
      <DisclosureContent>
        <div className="pt-3">{children}</div>
      </DisclosureContent>
    </Disclosure>
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
    <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
      <Icon name="warning" className="mt-0.5 text-amber-600 dark:text-amber-400" />
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Dégradation détectée : FC en hausse de {hrDrift.toFixed(1)}% sur les 2 derniers intervalles
        par rapport aux 2 premiers, avec allure stable.
      </p>
    </div>
  );
}
