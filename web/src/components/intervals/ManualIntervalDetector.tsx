import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import type { Activity } from "@/types/activity";
import {
  buildManualBlockPayload,
  detectBestSegments,
  getBlockDefaults,
  hasManualBlockOverride,
  isBikeSport,
  speedToPaceDecimal,
  type DetectedSegment,
  type ManualDetectionMetric,
  type ManualDetectionMode,
} from "@/services/manualIntervals.service";
import { formatDistance, formatDuration, formatPaceDecimal } from "@/services/format.service";

interface Props {
  activity: Activity;
  isLoadingStreams: boolean;
  onSave: (payload: ReturnType<typeof buildManualBlockPayload>) => Promise<void>;
}

interface MetricOption {
  value: ManualDetectionMetric;
  label: string;
}

const SELECT_CLASSNAME =
  "h-10 w-full rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

function formatMetricValue(
  segment: DetectedSegment,
  metric: ManualDetectionMetric,
  isBike: boolean
) {
  if (metric === "heart_rate") {
    return segment.avgHr != null ? `${Math.round(segment.avgHr)} bpm` : "--";
  }
  if (metric === "power") {
    return segment.avgPower != null ? `${Math.round(segment.avgPower)} W` : "--";
  }
  if (isBike) {
    return segment.avgSpeed != null ? `${(segment.avgSpeed * 3.6).toFixed(1)} km/h` : "--";
  }
  return segment.avgSpeed != null ? formatPaceDecimal(speedToPaceDecimal(segment.avgSpeed) ?? 0) : "--";
}

function formatDetectorDistance(distanceM: number) {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return formatDistance(distanceM);
}

function formatBlockSubtitle(activity: Activity, blockIndex: 1 | 2) {
  const block = activity.segmented_metrics?.interval_blocks?.[blockIndex - 1];
  if (!block) return "Bloc manuel";

  const parts: string[] = [];
  if (block.count) parts.push(`${block.count} reps`);
  if (block.representative_duration_sec) {
    parts.push(formatDuration(block.representative_duration_sec));
  } else if (block.representative_distance_m) {
    parts.push(formatDetectorDistance(block.representative_distance_m));
  }
  return parts.join(" · ") || "Bloc manuel";
}

export function ManualIntervalDetector({ activity, isLoadingStreams, onSave }: Props) {
  const isBike = isBikeSport(activity.sport_type);
  const streams = activity.activity_streams ?? [];
  const [selectedBlock, setSelectedBlock] = useState<1 | 2>(1);
  const [mode, setMode] = useState<ManualDetectionMode>("duration");
  const [metric, setMetric] = useState<ManualDetectionMetric>(isBike ? "power" : "speed");
  const [repetitions, setRepetitions] = useState("5");
  const [durationInput, setDurationInput] = useState("3:00");
  const [distanceInput, setDistanceInput] = useState("1000");
  const [segments, setSegments] = useState<DetectedSegment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const metricOptions = useMemo<MetricOption[]>(() => {
    const hasHr = streams.some((point) => point.hr != null);
    const hasSpeed = streams.some((point) => point.spd != null && point.spd > 0);
    const hasPower = streams.some((point) => point.pwr != null && point.pwr > 0);
    const options: MetricOption[] = [];

    if (isBike) {
      if (hasPower) options.push({ value: "power", label: "Puissance" });
      if (hasHr) options.push({ value: "heart_rate", label: "FC" });
      if (!hasPower && hasSpeed) options.push({ value: "speed", label: "Vitesse" });
    } else {
      if (hasSpeed) options.push({ value: "speed", label: "Allure" });
      if (hasHr) options.push({ value: "heart_rate", label: "FC" });
      if (!hasSpeed && hasPower) options.push({ value: "power", label: "Puissance" });
    }

    return options;
  }, [isBike, streams]);

  useEffect(() => {
    if (metricOptions.some((option) => option.value === metric)) return;
    setMetric(metricOptions[0]?.value ?? (isBike ? "power" : "speed"));
  }, [isBike, metric, metricOptions]);

  useEffect(() => {
    const block = activity.segmented_metrics?.interval_blocks?.[selectedBlock - 1];
    const defaults = getBlockDefaults(block);

    setRepetitions(String(defaults.count));
    if (defaults.durationSec) {
      const min = Math.floor(defaults.durationSec / 60);
      const sec = defaults.durationSec % 60;
      setMode("duration");
      setDurationInput(`${min}:${sec.toString().padStart(2, "0")}`);
    } else {
      setDurationInput("3:00");
    }
    if (defaults.distanceM) {
      setDistanceInput(String(defaults.distanceM));
    } else {
      setDistanceInput("1000");
    }
    setSegments([]);
    setSelectedIds([]);
    setError(null);
    setStatus(null);
  }, [activity.segmented_metrics?.interval_blocks, selectedBlock]);

  const selectedSegments = useMemo(
    () => segments.filter((segment) => selectedIds.includes(segment.id)),
    [segments, selectedIds]
  );

  const summary = useMemo(() => {
    if (selectedSegments.length === 0) return null;
    const totalDuration = selectedSegments.reduce((sum, segment) => sum + segment.durationSec, 0);
    const lastSegment = selectedSegments[selectedSegments.length - 1]!;
    const meanHr =
      totalDuration > 0
        ? selectedSegments.reduce((sum, segment) => sum + (segment.avgHr ?? 0) * segment.durationSec, 0) /
          selectedSegments.reduce((sum, segment) => sum + (segment.avgHr != null ? segment.durationSec : 0), 0)
        : null;
    const meanSpeed =
      totalDuration > 0
        ? selectedSegments.reduce((sum, segment) => sum + (segment.avgSpeed ?? 0) * segment.durationSec, 0) /
          selectedSegments.reduce((sum, segment) => sum + (segment.avgSpeed != null ? segment.durationSec : 0), 0)
        : null;
    const meanPower =
      totalDuration > 0
        ? selectedSegments.reduce((sum, segment) => sum + (segment.avgPower ?? 0) * segment.durationSec, 0) /
          selectedSegments.reduce((sum, segment) => sum + (segment.avgPower != null ? segment.durationSec : 0), 0)
        : null;

    return {
      meanHr: Number.isFinite(meanHr) ? meanHr : null,
      meanSpeed: Number.isFinite(meanSpeed) ? meanSpeed : null,
      meanPower: Number.isFinite(meanPower) ? meanPower : null,
      lastHr: lastSegment.avgHr ?? null,
      lastSpeed: lastSegment.avgSpeed ?? null,
      lastPower: lastSegment.avgPower ?? null,
    };
  }, [selectedSegments]);

  function parseDuration(value: string) {
    const match = value.trim().match(/^(\d{1,3}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function handleSearch() {
    setError(null);
    setStatus(null);

    const repetitionCount = Math.max(1, Number.parseInt(repetitions, 10) || 1);
    const targetDurationSec =
      mode === "duration" ? parseDuration(durationInput) ?? undefined : undefined;
    const targetDistanceM = mode === "distance" ? Number.parseFloat(distanceInput) : undefined;

    if (mode === "duration" && (!targetDurationSec || targetDurationSec <= 0)) {
      setError("Durée invalide. Utilise le format MM:SS.");
      return;
    }

    if (mode === "distance" && (!targetDistanceM || targetDistanceM <= 0)) {
      setError("Distance invalide.");
      return;
    }

    const detected = detectBestSegments({
      streams,
      mode,
      metric,
      repetitions: repetitionCount,
      targetDurationSec,
      targetDistanceM,
    });

    setSegments(detected);
    setSelectedIds(detected.map((segment) => segment.id));

    if (detected.length === 0) {
      setError("Aucun segment exploitable trouvé avec ces paramètres.");
      return;
    }

    setStatus(`${detected.length} segment(s) trouvé(s).`);
  }

  function toggleSegment(segmentId: string) {
    setSelectedIds((current) =>
      current.includes(segmentId)
        ? current.filter((id) => id !== segmentId)
        : [...current, segmentId]
    );
  }

  async function handleInject() {
    if (selectedSegments.length === 0) {
      setError("Sélectionne au moins un segment à injecter.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const payload = buildManualBlockPayload(activity, selectedBlock, selectedSegments);
      await onSave(payload);
      setStatus(`Bloc ${selectedBlock} mis à jour.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'injection.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const payload = buildManualBlockPayload(activity, selectedBlock, null);
      await onSave(payload);
      setSegments([]);
      setSelectedIds([]);
      setStatus(`Bloc ${selectedBlock} réinitialisé.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la réinitialisation.");
    } finally {
      setIsSaving(false);
    }
  }

  const currentBlockHasOverride = hasManualBlockOverride(activity, selectedBlock);
  const canSearch = streams.length > 0 && !isLoadingStreams && metricOptions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[1, 2].map((value) => {
          const blockIndex = value as 1 | 2;
          const active = selectedBlock === blockIndex;
          return (
            <button
              key={blockIndex}
              type="button"
              onClick={() => setSelectedBlock(blockIndex)}
              className={`rounded-sm border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Bloc {blockIndex}</span>
                {hasManualBlockOverride(activity, blockIndex) && <Badge variant="orange">manuel</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatBlockSubtitle(activity, blockIndex)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "duration" ? "primary" : "secondary"}
              onClick={() => setMode("duration")}
            >
              Durée
            </Button>
            <Button
              type="button"
              variant={mode === "distance" ? "primary" : "secondary"}
              onClick={() => setMode("distance")}
              disabled={!streams.some((point) => point.spd != null && point.spd > 0)}
            >
              Distance
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Métrique
          </label>
          <select
            className={SELECT_CLASSNAME}
            value={metric}
            onChange={(event) => setMetric(event.target.value as ManualDetectionMetric)}
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Répétitions
          </label>
          <Input
            type="number"
            min={1}
            max={20}
            value={repetitions}
            onChange={(event) => setRepetitions(event.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {mode === "duration" ? "Durée cible (MM:SS)" : "Distance cible (m)"}
          </label>
          {mode === "duration" ? (
            <Input value={durationInput} onChange={(event) => setDurationInput(event.target.value)} />
          ) : (
            <Input
              type="number"
              min={100}
              step={50}
              value={distanceInput}
              onChange={(event) => setDistanceInput(event.target.value)}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="w-full sm:w-auto" onClick={handleSearch} disabled={!canSearch}>
          <Icon name="analytics" className="text-base" />
          Lancer l'analyse
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleInject}
          disabled={selectedSegments.length === 0 || isSaving}
        >
          <Icon name="bolt" className="text-base" />
          Injecter le bloc
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={handleReset}
          disabled={(!currentBlockHasOverride && selectedSegments.length === 0) || isSaving}
        >
          <Icon name="restart_alt" className="text-base" />
          Réinitialiser
        </Button>
      </div>

      {isLoadingStreams && (
        <p className="text-sm text-slate-500">Chargement des streams FIT pour le détecteur...</p>
      )}
      {!isLoadingStreams && streams.length === 0 && (
        <p className="text-sm text-slate-500">
          Aucun stream exploitable pour cette séance. Le détecteur manuel reste indisponible.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {status && <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Moyenne</p>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {isBike
                ? summary.meanPower != null
                  ? `${Math.round(summary.meanPower)} W`
                  : "--"
                : summary.meanSpeed != null
                  ? formatPaceDecimal(speedToPaceDecimal(summary.meanSpeed) ?? 0)
                  : "--"}
            </p>
            <p className="text-xs text-slate-500">
              FC {summary.meanHr != null ? `${Math.round(summary.meanHr)} bpm` : "--"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dernier</p>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {isBike
                ? summary.lastPower != null
                  ? `${Math.round(summary.lastPower)} W`
                  : "--"
                : summary.lastSpeed != null
                  ? formatPaceDecimal(speedToPaceDecimal(summary.lastSpeed) ?? 0)
                  : "--"}
            </p>
            <p className="text-xs text-slate-500">
              FC {summary.lastHr != null ? `${Math.round(summary.lastHr)} bpm` : "--"}
            </p>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">Garder</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Valeur</th>
                <th className="px-4 py-3">FC</th>
                <th className="px-4 py-3">{isBike ? "Puissance" : "Allure"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {segments.map((segment) => {
                const checked = selectedIds.includes(segment.id);
                return (
                  <tr key={segment.id} className={checked ? "bg-white dark:bg-slate-900/40" : "opacity-60"}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSegment(segment.id)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-700 dark:text-slate-300">
                      {formatDuration(segment.startSec)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-700 dark:text-slate-300">
                      {formatDuration(segment.endSec)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                      {formatDuration(segment.durationSec)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                      {segment.distanceM > 0 ? formatDetectorDistance(segment.distanceM) : "--"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-900 dark:text-white">
                      {formatMetricValue(segment, metric, isBike)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                      {segment.avgHr != null ? `${Math.round(segment.avgHr)} bpm` : "--"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                      {isBike
                        ? segment.avgPower != null
                          ? `${Math.round(segment.avgPower)} W`
                          : "--"
                        : segment.avgSpeed != null
                          ? formatPaceDecimal(speedToPaceDecimal(segment.avgSpeed) ?? 0)
                          : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
