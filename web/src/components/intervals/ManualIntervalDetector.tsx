import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import type { Activity } from "@/types/activity";
import {
  buildManualBlockPayload,
  detectBestSegments,
  getExcludedSegmentsForBlock,
  getBlockDefaults,
  hasManualBlockOverride,
  isBikeSport,
  overlapsExcludedSegments,
  speedToPaceDecimal,
  type DetectedSegment,
  type ManualDetectionMetric,
  type ManualDetectionMode,
  type SegmentTimeRange,
} from "@/services/manualIntervals.service";
import { formatDistance, formatDuration, formatPaceDecimal, formatSwimPaceDecimal, speedToSwimPaceDecimal } from "@/services/format.service";
import { isSwimSport } from "@/services/activity.service";

interface Props {
  activity: Activity;
  isLoadingStreams: boolean;
  onSave: (payload: ReturnType<typeof buildManualBlockPayload>) => Promise<void>;
  onDetectedSegmentsChange?: (segments: DetectedSegment[]) => void;
  chartZoomWindow?: { start: number; end: number } | null;
}

interface MetricOption {
  value: ManualDetectionMetric;
  label: string;
}

const DEFAULT_SORT_BY = "start";
const DEFAULT_SORT_DIR: SortDirection = "asc";

function formatMetricValue(
  segment: DetectedSegment,
  metric: ManualDetectionMetric,
  isBike: boolean,
  isSwim: boolean,
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
  if (segment.avgSpeed == null) return "--";
  if (isSwim) return formatSwimPaceDecimal(speedToSwimPaceDecimal(segment.avgSpeed) ?? 0);
  return formatPaceDecimal(speedToPaceDecimal(segment.avgSpeed) ?? 0);
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hms = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = trimmed.match(/^(\d{1,3}):(\d{2})$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  return null;
}

function formatTimeInput(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDetectorDistance(distanceM: number) {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return formatDistance(distanceM);
}

function formatBlockSubtitle(activity: Activity, blockIndex: 1 | 2 | 3) {
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

export function ManualIntervalDetector({
  activity,
  isLoadingStreams,
  onSave,
  onDetectedSegmentsChange,
  chartZoomWindow,
}: Props) {
  const isBike = isBikeSport(activity.sport_type);
  const isSwim = isSwimSport(activity.sport_type);
  const streams = activity.activity_streams ?? [];
  const justInjectedRef = useRef(false);
  const [selectedBlock, setSelectedBlock] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<ManualDetectionMode>("duration");
  const [metric, setMetric] = useState<ManualDetectionMetric>(isBike ? "power" : "speed");
  const [repetitions, setRepetitions] = useState("5");
  const [durationInput, setDurationInput] = useState("3:00");
  const [distanceInput, setDistanceInput] = useState("1000");
  const [segments, setSegments] = useState<DetectedSegment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"index" | "start" | "end" | "duration" | "distance" | "value" | "hr" | "pace_or_power">(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRangeStart, setTimeRangeStart] = useState("");
  const [timeRangeEnd, setTimeRangeEnd] = useState("");

  const parsedTimeRange = useMemo(() => ({
    start: parseTimeInput(timeRangeStart),
    end: parseTimeInput(timeRangeEnd),
  }), [timeRangeStart, timeRangeEnd]);
  const hasTimeRange = parsedTimeRange.start != null || parsedTimeRange.end != null;

  const metricOptions = useMemo<MetricOption[]>(() => {
    const hasHr = streams.some((point) => point.hr != null);
    const hasSpeed = streams.some((point) => point.spd != null && point.spd > 0);
    const hasPower = streams.some((point) => point.pwr != null && point.pwr > 0);
    const options: MetricOption[] = [];

    if (isBike) {
      if (hasPower) options.push({ value: "power", label: "Puissance" });
      if (hasSpeed) options.push({ value: "speed", label: "Vitesse" });
      if (hasHr) options.push({ value: "heart_rate", label: "FC" });
    } else {
      if (hasSpeed) options.push({ value: "speed", label: "Allure" });
      if (hasPower) options.push({ value: "power", label: "Puissance" });
      if (hasHr) options.push({ value: "heart_rate", label: "FC" });
    }

    return options;
  }, [isBike, streams]);

  useEffect(() => {
    if (metricOptions.some((option) => option.value === metric)) return;
    setMetric(metricOptions[0]?.value ?? (isBike ? "power" : "speed"));
  }, [isBike, metric, metricOptions]);

  useEffect(() => {
    // After inject, the optimistic update changes interval_blocks reference —
    // skip resetting segments so the detected table stays visible.
    if (justInjectedRef.current) {
      justInjectedRef.current = false;
      return;
    }

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
    setTimeRangeStart("");
    setTimeRangeEnd("");
    onDetectedSegmentsChange?.([]);
  }, [activity.segmented_metrics?.interval_blocks, onDetectedSegmentsChange, selectedBlock]);

  const selectedSegments = useMemo(
    () => segments.filter((segment) => selectedIds.includes(segment.id)),
    [segments, selectedIds]
  );
  const excludedSegments = useMemo<SegmentTimeRange[]>(
    () => getExcludedSegmentsForBlock(activity.manual_interval_segments, selectedBlock),
    [activity.manual_interval_segments, selectedBlock]
  );

  const sortedSegments = useMemo(
    () =>
      sortRows(
        segments,
        (segment) => {
          switch (sortBy) {
            case "index":
              return segments.findIndex((item) => item.id === segment.id);
            case "start":
              return segment.startSec;
            case "end":
              return segment.endSec;
            case "duration":
              return segment.durationSec;
            case "distance":
              return segment.distanceM;
            case "hr":
              return segment.avgHr;
            case "pace_or_power":
              return isBike ? segment.avgPower : segment.avgSpeed;
            case "value":
            default:
              return segment.avgValue;
          }
        },
        sortDir
      ),
    [isBike, segments, sortBy, sortDir]
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

  function handleImportZoom() {
    if (!chartZoomWindow) return;
    setTimeRangeStart(formatTimeInput(chartZoomWindow.start));
    setTimeRangeEnd(formatTimeInput(chartZoomWindow.end));
  }

  function handleClearTimeRange() {
    setTimeRangeStart("");
    setTimeRangeEnd("");
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

    if (
      parsedTimeRange.start != null &&
      parsedTimeRange.end != null &&
      parsedTimeRange.start >= parsedTimeRange.end
    ) {
      setError("Plage temporelle invalide (début ≥ fin).");
      return;
    }

    const detected = detectBestSegments({
      streams,
      mode,
      metric,
      repetitions: repetitionCount,
      targetDurationSec,
      targetDistanceM,
      excludedSegments,
      timeRangeStartSec: parsedTimeRange.start ?? undefined,
      timeRangeEndSec: parsedTimeRange.end ?? undefined,
    });

    setSegments(detected);
    setSelectedIds(detected.map((segment) => segment.id));
    onDetectedSegmentsChange?.(detected);

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

  function handleSort(column: typeof sortBy) {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir(column === "value" ? "desc" : "asc");
      return;
    }

    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }

    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
  }

  async function handleInject() {
    if (selectedSegments.length === 0) {
      setError("Sélectionne au moins un segment à injecter.");
      return;
    }

    if (selectedSegments.some((segment) => overlapsExcludedSegments(segment, excludedSegments))) {
      setError(`Le bloc ${selectedBlock} ne peut pas chevaucher les segments déjà injectés dans l'autre bloc.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      justInjectedRef.current = true;
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
      onDetectedSegmentsChange?.([]);
      setStatus(`Bloc ${selectedBlock} réinitialisé.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la réinitialisation.");
    } finally {
      setIsSaving(false);
    }
  }

  const currentBlockHasOverride = hasManualBlockOverride(activity, selectedBlock);
  const canSearch = streams.length > 0 && !isLoadingStreams && metricOptions.length > 0;
  const hasDistanceStream = streams.some((point) => point.spd != null && point.spd > 0);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
        <Icon name="target" className="text-primary text-base" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">
          Détecteur Manuel
        </span>
      </div>

      {/* Bloc selector — tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {([1, 2, 3] as const).map((blockIndex) => {
          const active = selectedBlock === blockIndex;
          return (
            <button
              key={blockIndex}
              type="button"
              onClick={() => setSelectedBlock(blockIndex)}
              className={`relative flex-1 py-2.5 px-3 text-left transition-all
                ${active
                  ? "border-b-2 border-primary bg-primary/5 dark:bg-blue-500/15"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
            >
              <span className={`block text-[10px] tracking-widest uppercase mb-0.5 ${active ? "text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}>BLOC</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm ${active ? "font-semibold text-blue-600 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>{blockIndex}</span>
                {hasManualBlockOverride(activity, blockIndex) && (
                  <Badge variant="orange" className="text-[9px] px-1.5 py-0">manuel</Badge>
                )}
              </div>
              <span className={`block text-[10px] mt-0.5 ${active ? "text-blue-500/70 dark:text-blue-400/70" : "text-slate-500 dark:text-slate-400"}`}>
                {formatBlockSubtitle(activity, blockIndex)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Paramètres */}
      <div className="p-4 space-y-4">

        {/* Mode + Métrique en ligne */}
        <div className="flex items-start gap-5 flex-wrap">

          {/* Mode — pill segmenté */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Mode
            </label>
            <SlidingTabs
              items={[
                { key: "duration" as const, label: "Durée" },
                { key: "distance" as const, label: "Distance", disabled: !hasDistanceStream },
              ]}
              value={mode}
              onChange={setMode}
              size="sm"
              rounded="lg"
            />
          </div>

          {/* Métrique — chips */}
          {metricOptions.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Métrique
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {metricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMetric(option.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                      ${metric === option.value
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 text-slate-600 hover:border-primary/50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-primary/50"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reps + Cible côte à côte */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {mode === "duration" ? "Durée (MM:SS)" : "Distance (m)"}
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

        {/* Plage temporelle (optionnelle) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Plage temporelle
            </label>
            <div className="flex items-center gap-2">
              {chartZoomWindow && (
                <button
                  type="button"
                  onClick={handleImportZoom}
                  className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <Icon name="zoom_in" className="text-xs" />
                  Importer le zoom
                </button>
              )}
              {hasTimeRange && (
                <button
                  type="button"
                  onClick={handleClearTimeRange}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <Icon name="close" className="text-xs" />
                  Effacer
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Début (MM:SS)"
              value={timeRangeStart}
              onChange={(e) => setTimeRangeStart(e.target.value)}
            />
            <Input
              placeholder="Fin (MM:SS)"
              value={timeRangeEnd}
              onChange={(e) => setTimeRangeEnd(e.target.value)}
            />
          </div>
          {hasTimeRange && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5">
              <Icon name="schedule" className="text-xs text-blue-500 shrink-0" />
              <span className="text-[11px] text-blue-700 dark:text-blue-300">
                Recherche limitée :{" "}
                {parsedTimeRange.start != null ? formatTimeInput(parsedTimeRange.start) : "0:00"}
                {" → "}
                {parsedTimeRange.end != null ? formatTimeInput(parsedTimeRange.end) : "fin"}
              </span>
            </div>
          )}
        </div>

        {/* CTA principal — orange */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={!canSearch}
          className="w-full py-2.5 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Icon name="analytics" className="text-base" />
          Lancer l'analyse
        </button>

        {/* État streams */}
        {isLoadingStreams && (
          <p className="text-xs text-slate-500 text-center">Chargement des streams FIT…</p>
        )}
        {!isLoadingStreams && streams.length === 0 && (
          <p className="text-xs text-slate-500 text-center">
            Aucun stream exploitable. Le détecteur reste indisponible.
          </p>
        )}
      </div>

      {/* Feedback error */}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <Icon name="error" className="text-base flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Feedback success */}
      {status && (
        <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-100 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <Icon name="check_circle" className="text-base flex-shrink-0" />
          {status}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Moyenne</p>
            <p className="text-base font-mono font-semibold text-slate-800 dark:text-slate-100">
              {isBike
                ? summary.meanPower != null
                  ? `${Math.round(summary.meanPower)} W`
                  : "--"
                : summary.meanSpeed != null
                  ? isSwim
                    ? formatSwimPaceDecimal(speedToSwimPaceDecimal(summary.meanSpeed) ?? 0)
                    : formatPaceDecimal(speedToPaceDecimal(summary.meanSpeed) ?? 0)
                  : "--"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              FC {summary.meanHr != null ? `${Math.round(summary.meanHr)} bpm` : "--"}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Dernier</p>
            <p className="text-base font-mono font-semibold text-slate-800 dark:text-slate-100">
              {isBike
                ? summary.lastPower != null
                  ? `${Math.round(summary.lastPower)} W`
                  : "--"
                : summary.lastSpeed != null
                  ? isSwim
                    ? formatSwimPaceDecimal(speedToSwimPaceDecimal(summary.lastSpeed) ?? 0)
                    : formatPaceDecimal(speedToPaceDecimal(summary.lastSpeed) ?? 0)
                  : "--"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              FC {summary.lastHr != null ? `${Math.round(summary.lastHr)} bpm` : "--"}
            </p>
          </div>
        </div>
      )}

      {/* Table résultats */}
      {segments.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <SortableHeader label="#" active={sortBy === "index"} direction={sortDir} onToggle={() => handleSort("index")} className="px-3 py-2.5" />
                <SortableHeader label="Début" active={sortBy === "start"} direction={sortDir} onToggle={() => handleSort("start")} className="px-3 py-2.5" />
                <SortableHeader label="Fin" active={sortBy === "end"} direction={sortDir} onToggle={() => handleSort("end")} className="px-3 py-2.5" />
                <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-3 py-2.5" />
                <SortableHeader label="Dist." active={sortBy === "distance"} direction={sortDir} onToggle={() => handleSort("distance")} className="px-3 py-2.5" />
                <SortableHeader label="Valeur" active={sortBy === "value"} direction={sortDir} onToggle={() => handleSort("value")} className="px-3 py-2.5" />
                <SortableHeader label="FC" active={sortBy === "hr"} direction={sortDir} onToggle={() => handleSort("hr")} className="px-3 py-2.5" />
                <SortableHeader label={isBike ? "Watt" : "Allure"} active={sortBy === "pace_or_power"} direction={sortDir} onToggle={() => handleSort("pace_or_power")} className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedSegments.map((segment, index) => {
                const checked = selectedIds.includes(segment.id);
                return (
                  <tr
                    key={segment.id}
                    onClick={() => toggleSegment(segment.id)}
                    className={`cursor-pointer transition-colors ${
                      checked
                        ? "bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        : "opacity-50 hover:opacity-70"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSegment(segment.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="font-mono text-xs text-slate-400">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {formatDuration(segment.startSec)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {formatDuration(segment.endSec)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatDuration(segment.durationSec)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {segment.distanceM > 0 ? formatDetectorDistance(segment.distanceM) : "--"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {formatMetricValue(segment, metric, isBike, isSwim)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {segment.avgHr != null ? `${Math.round(segment.avgHr)} bpm` : "--"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {isBike
                        ? segment.avgPower != null
                          ? `${Math.round(segment.avgPower)} W`
                          : "--"
                        : segment.avgSpeed != null
                          ? isSwim
                            ? formatSwimPaceDecimal(speedToSwimPaceDecimal(segment.avgSpeed) ?? 0)
                            : formatPaceDecimal(speedToPaceDecimal(segment.avgSpeed) ?? 0)
                          : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions secondaires */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={handleInject}
          disabled={selectedSegments.length === 0 || isSaving}
        >
          <Icon name="bolt" className="text-base" />
          Injecter le bloc
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          disabled={(!currentBlockHasOverride && selectedSegments.length === 0) || isSaving}
        >
          <Icon name="restart_alt" className="text-base" />
          Réinitialiser
        </Button>
      </div>

    </div>
  );
}
