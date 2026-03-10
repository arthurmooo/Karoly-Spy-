import { Link, useParams } from "react-router-dom";
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
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { ActivityStreamChart } from "@/components/charts/ActivityStreamChart";
import { ManualIntervalDetector } from "@/components/intervals/ManualIntervalDetector";
import { LapsTable } from "@/components/tables/LapsTable";
import { useActivityDetail } from "@/hooks/useActivityDetail";
import type { Activity, ActivityInterval, ActivitySourceJson, IntervalBlock } from "@/types/activity";
import { useState, useEffect } from "react";
import {
  formatDistance,
  formatDuration,
  formatPaceDecimal,
} from "@/services/format.service";
import { formatPaceOrPower, mapWorkTypeLabel } from "@/services/activity.service";

interface DisplayBlock {
  id: string;
  label: string;
  durationSec: number | null;
  pace: number | null;
  power: number | null;
  hr: number | null;
  source: string | null;
  count: number | null;
}

const INTERVAL_TYPE_LABELS: Record<string, string> = {
  work: "Effort",
  rest: "Récup",
  warmup: "Échauffement",
  cooldown: "Retour calme",
};

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

function getFeedbackText(sourceJson: ActivitySourceJson | null | undefined): string {
  const text = sourceJson?.comment ?? sourceJson?.description ?? "";
  return text.trim();
}

function getFeelingLabel(feeling: number | null | undefined): string {
  if (feeling == null) return "Non renseigné";
  if (feeling >= 4) return "Bon ressenti";
  if (feeling === 3) return "Neutre";
  return "Ressenti à surveiller";
}

function getBlockManualOverride(activity: Activity, blockIndex: 1 | 2) {
  if (blockIndex === 1) {
    return {
      paceMean: activity.manual_interval_block_1_pace_mean ?? null,
      paceLast: activity.manual_interval_block_1_pace_last ?? null,
      powerMean: activity.manual_interval_block_1_power_mean ?? null,
      powerLast: activity.manual_interval_block_1_power_last ?? null,
      hrMean: activity.manual_interval_block_1_hr_mean ?? null,
      hrLast: activity.manual_interval_block_1_hr_last ?? null,
    };
  }

  return {
    paceMean: activity.manual_interval_block_2_pace_mean ?? null,
    paceLast: activity.manual_interval_block_2_pace_last ?? null,
    powerMean: activity.manual_interval_block_2_power_mean ?? null,
    powerLast: activity.manual_interval_block_2_power_last ?? null,
    hrMean: activity.manual_interval_block_2_hr_mean ?? null,
    hrLast: activity.manual_interval_block_2_hr_last ?? null,
  };
}

function buildBlocksFromSegmentedMetrics(
  activity: Activity,
  blocks: IntervalBlock[] | undefined
): DisplayBlock[] {
  return (blocks ?? []).map((block) => {
    const blockIndex = block.block_index === 2 ? 2 : 1;
    const manual = getBlockManualOverride(activity, blockIndex);
    const isManual =
      manual.paceMean != null ||
      manual.paceLast != null ||
      manual.powerMean != null ||
      manual.powerLast != null ||
      manual.hrMean != null ||
      manual.hrLast != null;

    return {
    id: `segmented-${block.block_index}`,
    label: `Bloc ${block.block_index}`,
    durationSec: block.total_duration_sec ?? block.representative_duration_sec ?? null,
    pace: manual.paceMean ?? manual.paceLast ?? block.interval_pace_mean ?? block.interval_pace_last ?? null,
    power:
      manual.powerMean ?? manual.powerLast ?? block.interval_power_mean ?? block.interval_power_last ?? null,
    hr: manual.hrMean ?? manual.hrLast ?? block.interval_hr_mean ?? block.interval_hr_last ?? null,
    source: isManual ? "manuel" : "segmented_metrics",
    count: block.count,
    };
  });
}

function buildBlocksFromIntervals(intervals: ActivityInterval[]): DisplayBlock[] {
  return intervals.map((intv, index) => ({
    id: intv.id,
    label: INTERVAL_TYPE_LABELS[intv.type] ?? `Bloc ${index + 1}`,
    durationSec: intv.duration ?? null,
    pace: intv.avg_speed ? 1000 / intv.avg_speed / 60 : null,
    power: intv.avg_power ?? null,
    hr: intv.avg_hr ?? null,
    source: intv.detection_source ?? null,
    count: null,
  }));
}

export function ActivityDetailPage() {
  const { id } = useParams();
  const {
    activity,
    intervals,
    isLoading,
    isLoadingStreams,
    isSaving,
    saveError,
    nolioSynced,
    saveCoachComment,
    saveManualDetectorOverride,
  } = useActivityDetail(id);
  const [coachNote, setCoachNote] = useState("");

  useEffect(() => {
    if (activity?.coach_comment != null) {
      setCoachNote(activity.coach_comment);
    }
  }, [activity?.coach_comment]);

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
        <Link
          to="/activities"
          className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <Icon name="arrow_back" className="text-lg" />
          Retour aux activités
        </Link>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Icon name="search_off" className="text-4xl text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
            Activité introuvable
          </p>
        </div>
      </div>
    );
  }

  const athleteName = activity.athletes
    ? `${activity.athletes.first_name} ${activity.athletes.last_name.charAt(0)}.`
    : "Inconnu";

  const title = activity.manual_activity_name || activity.activity_name || "Activité";
  const sessionDate = activity.session_date
    ? new Date(activity.session_date).toLocaleDateString("fr-FR")
    : "--";
  const durationStr = activity.duration_sec ? formatDuration(activity.duration_sec) : "--";
  const distanceStr = activity.distance_m ? formatDistance(activity.distance_m) : "--";
  const mlsStr = activity.load_index != null ? activity.load_index.toFixed(1) : "--";
  const hrStr = activity.avg_hr != null ? `${Math.round(activity.avg_hr)} bpm` : "--";

  const avgSpeed =
    activity.distance_m && activity.duration_sec
      ? activity.distance_m / activity.duration_sec
      : null;
  const paceStr = formatPaceOrPower(activity.sport_type ?? "", avgSpeed, activity.avg_power ?? null);

  const sourceJson = activity.source_json ?? null;
  const segmentedMetrics = activity.segmented_metrics ?? null;
  const segmentedBlocks = buildBlocksFromSegmentedMetrics(activity, segmentedMetrics?.interval_blocks);
  const fallbackBlocks = buildBlocksFromIntervals(intervals);
  const displayBlocks = segmentedBlocks.length > 0 ? segmentedBlocks : fallbackBlocks;
  const isBike = BIKE_SPORTS.has(activity.sport_type ?? "");
  const rpe = activity.rpe ?? sourceJson?.rpe ?? null;
  const athleteFeedback = getFeedbackText(sourceJson);
  const feeling = sourceJson?.feeling ?? null;
  const hasFitFile = Boolean(activity.fit_file_path);
  const hasStreams = Boolean(activity.activity_streams?.length);
  const hasLaps = Boolean(activity.garmin_laps?.length);

  const isDirty = coachNote !== (activity?.coach_comment ?? "");

  const chartData = displayBlocks.map((block, index) => ({
    index: index + 1,
    label: block.label,
    hr: block.hr != null ? Math.round(block.hr) : null,
    pace: block.pace != null ? Number(block.pace.toFixed(2)) : null,
    power: block.power != null ? Math.round(block.power) : null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/activities"
          className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <Icon name="arrow_back" className="text-lg" />
          Retour aux activités
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
              {hasFitFile && <Badge variant="emerald">FIT stocké</Badge>}
              {segmentedBlocks.length > 0 && <Badge variant="primary">Blocs détectés</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Icon name="person" className="text-slate-400" />
                {athleteName}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
                <Icon name="calendar_today" className="text-slate-400" />
                {sessionDate}
              </span>
              <Badge variant="primary">{mapWorkTypeLabel(activity.work_type)}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Durée</p>
            <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">{durationStr}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Distance</p>
            <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">{distanceStr}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">MLS</p>
            <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">{mlsStr}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">FC Moy</p>
            <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">{hrStr}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {isBike ? "Puissance Moy" : "Allure Moy"}
            </p>
            <h3 className="font-mono text-2xl font-semibold text-accent-orange">{paceStr}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
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
              ) : displayBlocks.length > 0 ? (
                <>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                    <Icon name="show_chart" className="text-slate-400" />
                    Analyse de la performance
                  </h2>
                  <Badge variant={segmentedBlocks.length > 0 ? "emerald" : "amber"}>
                    {segmentedBlocks.length > 0 ? "Parité Retool" : "Fallback intervalles"}
                  </Badge>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="index"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        reversed={!isBike}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === "hr") return [`${value} bpm`, "FC"];
                          if (name === "pace") return [formatPaceDecimal(value), "Allure bloc"];
                          if (name === "power") return [`${value} W`, "Puissance bloc"];
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Bloc ${label}`}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="hr"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="stepAfter"
                        dataKey={isBike ? "power" : "pace"}
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
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
                <FeatureNotice
                  title="Courbe FIT point à point"
                  description="Aucun FIT stocké pour cette séance. La web app ne peut pas reconstituer une courbe point à point à partir des seules données agrégées en base."
                  status="backend"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <Icon name="format_list_numbered" className="text-slate-400" />
                  Intervalles / Laps
                </h2>
                <Badge variant={segmentedBlocks.length > 0 ? "emerald" : "slate"}>
                  {segmentedBlocks.length > 0 ? "Depuis segmented_metrics" : "Depuis activity_intervals"}
                </Badge>
              </div>

              {displayBlocks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                        <th className="px-6 py-3">Bloc</th>
                        <th className="px-6 py-3">Durée</th>
                        <th className="px-6 py-3">{isBike ? "Puissance" : "Allure"}</th>
                        <th className="px-6 py-3">FC Moy</th>
                        <th className="px-6 py-3">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayBlocks.map((block) => (
                        <tr key={block.id}>
                          <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{block.label}</span>
                              {block.count != null && block.count > 1 && (
                                <Badge variant="slate">{block.count} reps</Badge>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">
                            {block.durationSec != null ? formatDuration(block.durationSec) : "--"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">
                            {isBike
                              ? block.power != null
                                ? `${Math.round(block.power)} W`
                                : "--"
                              : block.pace != null
                                ? formatPaceDecimal(block.pace)
                                : "--"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">
                            {block.hr != null ? `${Math.round(block.hr)} bpm` : "--"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-500">
                            {block.source ?? activity.interval_detection_source ?? "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                  Pas de laps détectés pour cette séance
                </div>
              )}

              <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Icon name="info" className="text-sm" />
                  Source de détection : {activity.interval_detection_source ?? "non renseignée"}
                </p>
              </div>
            </CardContent>
          </Card>

          {hasLaps && (
            <Card>
              <CardContent className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                    <Icon name="timer" className="text-slate-400" />
                    Laps Garmin
                  </h2>
                  <Badge variant="emerald">{activity.garmin_laps!.length} laps</Badge>
                </div>
                <LapsTable laps={activity.garmin_laps!} sportType={activity.sport_type} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Icon name="radar" className="text-slate-400" />
                Détecteur Manuel
              </h2>
              {!hasStreams && !isLoadingStreams ? (
                <FeatureNotice
                  title="Streams requis"
                  description="Le détecteur manuel s'appuie sur les streams FIT déjà chargés pour cette séance. Sans streams, l'analyse manuelle n'est pas possible."
                  status="backend"
                />
              ) : null}
              <ManualIntervalDetector
                activity={activity}
                isLoadingStreams={isLoadingStreams}
                onSave={saveManualDetectorOverride}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Icon name="person" className="text-slate-400" />
                Feedback Athlète
              </h2>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Ressenti de l'effort (RPE)
                </p>
                {rpe != null ? (
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {rpe}
                      <span className="ml-1 text-lg text-slate-400">/10</span>
                    </span>
                    <div className="flex flex-1 gap-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-none ${
                            i < rpe ? "bg-accent-orange" : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">Non renseigné</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Feeling Nolio</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {getFeelingLabel(feeling)}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Commentaire remonté</p>
                <textarea
                  readOnly
                  className="h-28 w-full resize-none rounded-sm border border-slate-200 bg-slate-50 p-3 text-sm italic text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  value={athleteFeedback}
                  placeholder="Aucun commentaire de l'athlète remonté depuis Nolio"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Icon name="comment" className="text-slate-400" />
                Notes du Coach
              </h2>
              <textarea
                className="h-24 w-full resize-none rounded-sm border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                placeholder="Écrire un feedback à l'athlète..."
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
                disabled={isSaving}
              />
              <Button
                className="w-full"
                disabled={!isDirty || isSaving}
                onClick={() => saveCoachComment(coachNote)}
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="send" />
                )}
                {isSaving ? "Envoi..." : "Envoyer"}
              </Button>
              {saveError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>
              )}
              {nolioSynced === true && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Synchronisé avec Nolio</p>
              )}
              {nolioSynced === false && !saveError && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Enregistré localement, sync Nolio échouée</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
