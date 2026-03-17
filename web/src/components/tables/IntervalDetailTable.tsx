import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import type { ActivityInterval, RepWindow } from "@/types/activity";
import { formatDuration, formatPaceDecimal } from "@/services/format.service";

interface Props {
  intervals: ActivityInterval[];
  sportType: string;
  repWindows?: RepWindow[] | null;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

// ── Interval view types ──

interface RowData {
  index: number;
  duration: number | null;
  paceOrPower: number | null;
  paceOrPowerLast: number | null;
  hr: number | null;
  hrLast: number | null;
  paHr: number | null;
  driftPercent: number | null;
  costBadge: CostLevel;
}

type CostLevel = "stable" | "hausse" | "alerte" | null;

function getCostBadge(drift: number | null): CostLevel {
  if (drift == null) return null;
  if (Math.abs(drift) < 3) return "stable";
  if (Math.abs(drift) < 8) return "hausse";
  return "alerte";
}

const COST_CONFIG = {
  stable: { label: "Stable", variant: "emerald" as const },
  hausse: { label: "En hausse", variant: "amber" as const },
  alerte: { label: "Alerte", variant: "red" as const },
};

type SortCol =
  | "index" | "duration" | "paceOrPower" | "paceOrPowerLast"
  | "hr" | "hrLast" | "paHr" | "drift" | "cost"
  | "hrCorr" | "output" | "ea";

interface SummaryData {
  count: number;
  totalDuration: number | null;
  avgPaceOrPower: number | null;
  avgHr: number | null;
  paceOrPowerLast: number | null;
  hrLast: number | null;
  avgPaHr: number | null;
  globalDrift: number | null;
  costBadge: CostLevel;
}

// ── Windows (stab) view types ──

interface WindowRow {
  index: number;
  duration: number | null;
  pace: number | null;        // min/km (run) or W (bike)
  hr: number | null;
  hrCorr: number | null;
  output: number | null;      // raw output value (m/s run, W bike)
  ea: number | null;
  paHr: number | null;
  driftPercent: number | null;
  costBadge: CostLevel;
}

interface WindowSummary {
  count: number;
  totalDuration: number | null;
  avgPace: number | null;
  avgHr: number | null;
  avgHrCorr: number | null;
  avgOutput: number | null;
  avgEa: number | null;
  avgPaHr: number | null;
  globalDrift: number | null;
  costBadge: CostLevel;
}

type ViewMode = "intervals" | "windows";

export function IntervalDetailTable({ intervals, sportType, repWindows }: Props) {
  const isBike = BIKE_SPORTS.has(sportType);
  const [sortBy, setSortBy] = useState<SortCol>("index");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ViewMode>("intervals");

  const hasWindows = Boolean(repWindows && repWindows.length > 0);

  // ── Interval rows ──

  const rows = useMemo<RowData[]>(() => {
    const active = intervals.filter((i) => i.type === "work" || i.type === "active");
    if (active.length === 0) return [];

    const firstHr = active[0]!.avg_hr;

    return active.map((intv, i) => {
      const paceOrPower = isBike
        ? intv.avg_power ?? null
        : intv.avg_speed && intv.avg_speed > 0
          ? 1000 / intv.avg_speed / 60
          : null;

      const paHr =
        intv.avg_hr && paceOrPower
          ? isBike
            ? (intv.avg_power ?? 0) / intv.avg_hr
            : (intv.avg_speed ?? 0) / intv.avg_hr
          : null;

      const driftPercent =
        firstHr && intv.avg_hr
          ? ((intv.avg_hr - firstHr) / firstHr) * 100
          : null;

      return {
        index: i + 1,
        duration: intv.duration ?? null,
        paceOrPower,
        paceOrPowerLast: null, // filled only on summary
        hr: intv.avg_hr != null ? Math.round(intv.avg_hr) : null,
        hrLast: null, // filled only on summary
        paHr,
        driftPercent,
        costBadge: getCostBadge(driftPercent),
      };
    });
  }, [intervals, isBike]);

  const summary = useMemo<SummaryData | null>(() => {
    if (rows.length === 0) return null;

    const count = rows.length;
    const durValues = rows.filter((r) => r.duration != null).map((r) => r.duration!);
    const totalDuration = durValues.length > 0 ? durValues.reduce((a, b) => a + b, 0) : null;

    // Duration-weighted pace/power
    let avgPaceOrPower: number | null = null;
    if (totalDuration && totalDuration > 0) {
      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of rows) {
        if (r.paceOrPower != null && r.duration != null) {
          weightedSum += r.paceOrPower * r.duration;
          weightTotal += r.duration;
        }
      }
      if (weightTotal > 0) avgPaceOrPower = weightedSum / weightTotal;
    }

    // Duration-weighted HR
    let avgHr: number | null = null;
    if (totalDuration && totalDuration > 0) {
      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of rows) {
        if (r.hr != null && r.duration != null) {
          weightedSum += r.hr * r.duration;
          weightTotal += r.duration;
        }
      }
      if (weightTotal > 0) avgHr = Math.round(weightedSum / weightTotal);
    }

    // Average Pa:HR
    const paHrValues = rows.filter((r) => r.paHr != null).map((r) => r.paHr!);
    const avgPaHr = paHrValues.length > 0 ? paHrValues.reduce((a, b) => a + b, 0) / paHrValues.length : null;

    // Global drift = last vs first
    const lastRow = rows[rows.length - 1]!;
    const globalDrift = lastRow.driftPercent;

    // Last values = values of the last rep
    const paceOrPowerLast = lastRow.paceOrPower;
    const hrLast = lastRow.hr;

    return {
      count,
      totalDuration,
      avgPaceOrPower,
      avgHr,
      paceOrPowerLast,
      hrLast,
      avgPaHr,
      globalDrift,
      costBadge: getCostBadge(globalDrift),
    };
  }, [rows]);

  const sortedIntervals = useMemo(
    () =>
      sortRows(
        rows,
        (row) => {
          switch (sortBy) {
            case "duration": return row.duration;
            case "paceOrPower": return row.paceOrPower;
            case "paceOrPowerLast": return row.paceOrPowerLast;
            case "hr": return row.hr;
            case "hrLast": return row.hrLast;
            case "paHr": return row.paHr;
            case "drift": return row.driftPercent;
            case "cost": return row.costBadge;
            default: return row.index;
          }
        },
        sortDir
      ),
    [rows, sortBy, sortDir]
  );

  // ── Window rows ──

  const windowRows = useMemo<WindowRow[]>(() => {
    if (!repWindows || repWindows.length === 0) return [];
    const firstHr = repWindows[0]!.hr_raw;

    return repWindows.map((w) => {
      // output is km/h (run) or W (bike)
      const pace = w.output != null && w.output > 0
        ? isBike ? Math.round(w.output) : 60 / w.output
        : null;

      const hrRef = w.hr_corr ?? w.hr_raw;
      const paHr = w.output != null && hrRef != null && hrRef > 0
        ? w.output / hrRef
        : null;

      const driftPercent =
        firstHr != null && firstHr > 0 && w.hr_raw != null
          ? ((w.hr_raw - firstHr) / firstHr) * 100
          : null;

      return {
        index: w.rep_index,
        duration: w.duration_sec ?? null,
        pace,
        hr: w.hr_raw != null ? Math.round(w.hr_raw) : null,
        hrCorr: w.hr_corr != null ? Math.round(w.hr_corr) : null,
        output: w.output ?? null,
        ea: w.ea ?? null,
        paHr,
        driftPercent,
        costBadge: getCostBadge(driftPercent),
      };
    });
  }, [repWindows, isBike]);

  const windowSummary = useMemo<WindowSummary | null>(() => {
    if (windowRows.length === 0) return null;

    const count = windowRows.length;
    const durValues = windowRows.filter((r) => r.duration != null).map((r) => r.duration!);
    const totalDuration = durValues.length > 0 ? durValues.reduce((a, b) => a + b, 0) : null;

    function durationWeighted(getter: (r: WindowRow) => number | null): number | null {
      if (!totalDuration || totalDuration <= 0) return null;
      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of windowRows) {
        const v = getter(r);
        if (v != null && r.duration != null) {
          weightedSum += v * r.duration;
          weightTotal += r.duration;
        }
      }
      return weightTotal > 0 ? weightedSum / weightTotal : null;
    }

    const avgPace = durationWeighted((r) => r.pace);
    const avgHrRaw = durationWeighted((r) => r.hr);
    const avgHr = avgHrRaw != null ? Math.round(avgHrRaw) : null;
    const avgHrCorrRaw = durationWeighted((r) => r.hrCorr);
    const avgHrCorr = avgHrCorrRaw != null ? Math.round(avgHrCorrRaw) : null;
    const avgOutput = durationWeighted((r) => r.output);
    const avgEa = durationWeighted((r) => r.ea);
    const avgPaHrValues = windowRows.filter((r) => r.paHr != null).map((r) => r.paHr!);
    const avgPaHr = avgPaHrValues.length > 0 ? avgPaHrValues.reduce((a, b) => a + b, 0) / avgPaHrValues.length : null;

    const lastRow = windowRows[windowRows.length - 1]!;
    const globalDrift = lastRow.driftPercent;

    return {
      count,
      totalDuration,
      avgPace,
      avgHr,
      avgHrCorr,
      avgOutput,
      avgEa,
      avgPaHr,
      globalDrift,
      costBadge: getCostBadge(globalDrift),
    };
  }, [windowRows]);

  const sortedWindows = useMemo(
    () =>
      sortRows(
        windowRows,
        (row) => {
          switch (sortBy) {
            case "duration": return row.duration;
            case "paceOrPower": return row.pace;
            case "hr": return row.hr;
            case "hrCorr": return row.hrCorr;
            case "output": return row.output;
            case "ea": return row.ea;
            case "paHr": return row.paHr;
            case "drift": return row.driftPercent;
            case "cost": return row.costBadge;
            default: return row.index;
          }
        },
        sortDir
      ),
    [windowRows, sortBy, sortDir]
  );

  // ── Helpers ──

  const activeSummary = view === "intervals" ? summary : windowSummary;
  if (!activeSummary) return null;

  const handleSort = (col: SortCol) => {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortBy("index");
      setSortDir("asc");
    }
  };

  function formatPace(val: number | null): string {
    if (val == null) return "--";
    return isBike ? `${Math.round(val)} W` : formatPaceDecimal(val);
  }

  function formatOutput(val: number | null): string {
    if (val == null) return "--";
    if (isBike) return `${Math.round(val)} W`;
    // output is km/h → convert to min/km
    return val > 0 ? formatPaceDecimal(60 / val) : "--";
  }

  // ── Render ──

  return (
    <div className="overflow-x-auto">
      {/* Apple-style toggle */}
      {hasWindows && (
        <div className="mb-3 flex items-center justify-end gap-2.5">
          <span className={`text-xs font-medium transition-colors ${view === "intervals" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
            Intervalles
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={view === "windows"}
            aria-label="Basculer entre Intervalles et Fenêtres stabilisées"
            onClick={() => { setView(view === "intervals" ? "windows" : "intervals"); setSortBy("index"); setSortDir("asc"); }}
            className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
              view === "windows"
                ? "bg-blue-600"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[18px] w-[18px] translate-y-[2px] rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out ${
                view === "windows" ? "translate-x-[20px]" : "translate-x-[2px]"
              }`}
            />
          </button>
          <span className={`text-xs font-medium transition-colors ${view === "windows" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
            Fenêtres stab.
          </span>
        </div>
      )}

      {view === "intervals" ? (
        <IntervalView
          summary={summary!}
          sorted={sortedIntervals}
          expanded={expanded}
          setExpanded={setExpanded}
          sortBy={sortBy}
          sortDir={sortDir}
          handleSort={handleSort}
          isBike={isBike}
          formatPace={formatPace}
        />
      ) : (
        <WindowView
          summary={windowSummary!}
          sorted={sortedWindows}
          expanded={expanded}
          setExpanded={setExpanded}
          sortBy={sortBy}
          sortDir={sortDir}
          handleSort={handleSort}
          isBike={isBike}
          formatPace={formatPace}
          formatOutput={formatOutput}
        />
      )}
    </div>
  );
}

// ── Interval view ──

function IntervalView({
  summary,
  sorted,
  expanded,
  setExpanded,
  sortBy,
  sortDir,
  handleSort,
  isBike,
  formatPace,
}: {
  summary: SummaryData;
  sorted: RowData[];
  expanded: boolean;
  setExpanded: (fn: (v: boolean) => boolean) => void;
  sortBy: SortCol;
  sortDir: SortDirection;
  handleSort: (col: SortCol) => void;
  isBike: boolean;
  formatPace: (v: number | null) => string;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <SortableHeader label="#" active={sortBy === "index"} direction={sortDir} onToggle={() => handleSort("index")} className="px-4 py-2" />
          <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-4 py-2" />
          <SortableHeader label={isBike ? "Puiss. Moy" : "Allure Moy"} active={sortBy === "paceOrPower"} direction={sortDir} onToggle={() => handleSort("paceOrPower")} className="px-4 py-2" />
          <SortableHeader label={isBike ? "Puiss. Last" : "Allure Last"} active={sortBy === "paceOrPowerLast"} direction={sortDir} onToggle={() => handleSort("paceOrPowerLast")} className="px-4 py-2" />
          <SortableHeader label="FC Moy" active={sortBy === "hr"} direction={sortDir} onToggle={() => handleSort("hr")} className="px-4 py-2" />
          <SortableHeader label="FC Last" active={sortBy === "hrLast"} direction={sortDir} onToggle={() => handleSort("hrLast")} className="px-4 py-2" />
          <SortableHeader label="Pa:HR" active={sortBy === "paHr"} direction={sortDir} onToggle={() => handleSort("paHr")} className="px-4 py-2" />
          <SortableHeader label="Dérive FC" active={sortBy === "drift"} direction={sortDir} onToggle={() => handleSort("drift")} className="px-4 py-2" />
          <SortableHeader label="Coût" active={sortBy === "cost"} direction={sortDir} onToggle={() => handleSort("cost")} className="px-4 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Summary row */}
        <tr
          className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Icon name={expanded ? "expand_less" : "expand_more"} className="text-lg text-slate-400" />
              <span>1–{summary.count}</span>
              <Badge variant="slate">{summary.count} reps</Badge>
            </div>
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.totalDuration != null ? formatDuration(summary.totalDuration) : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.avgPaceOrPower)}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.paceOrPowerLast)}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-accent-orange">
            {summary.avgHr != null ? `${summary.avgHr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-accent-orange">
            {summary.hrLast != null ? `${summary.hrLast} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgPaHr != null ? summary.avgPaHr.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.globalDrift != null ? `${summary.globalDrift > 0 ? "+" : ""}${summary.globalDrift.toFixed(1)}%` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2">
            <CostBadge level={summary.costBadge} />
          </td>
        </tr>

        {/* Detail rows */}
        {expanded && sorted.map((row) => (
          <tr key={row.index} className="bg-blue-50/30 dark:bg-slate-800/30">
            <td className="whitespace-nowrap px-4 py-1.5 pl-10 text-xs font-medium text-slate-500 dark:text-slate-400">
              #{row.index}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.duration != null ? formatDuration(row.duration) : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs font-semibold text-accent-blue">
              {formatPace(row.paceOrPower)}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-400">
              --
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-accent-orange">
              {row.hr != null ? `${row.hr} bpm` : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-400">
              --
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.paHr != null ? row.paHr.toFixed(3) : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.driftPercent != null ? `${row.driftPercent > 0 ? "+" : ""}${row.driftPercent.toFixed(1)}%` : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5">
              <CostBadge level={row.costBadge} size="xs" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Window (stab) view ──

function WindowView({
  summary,
  sorted,
  expanded,
  setExpanded,
  sortBy,
  sortDir,
  handleSort,
  isBike,
  formatPace,
  formatOutput,
}: {
  summary: WindowSummary;
  sorted: WindowRow[];
  expanded: boolean;
  setExpanded: (fn: (v: boolean) => boolean) => void;
  sortBy: SortCol;
  sortDir: SortDirection;
  handleSort: (col: SortCol) => void;
  isBike: boolean;
  formatPace: (v: number | null) => string;
  formatOutput: (v: number | null) => string;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <SortableHeader label="#" active={sortBy === "index"} direction={sortDir} onToggle={() => handleSort("index")} className="px-4 py-2" />
          <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-4 py-2" />
          <SortableHeader label={isBike ? "Puissance" : "Allure"} active={sortBy === "paceOrPower"} direction={sortDir} onToggle={() => handleSort("paceOrPower")} className="px-4 py-2" />
          <SortableHeader label="FC" active={sortBy === "hr"} direction={sortDir} onToggle={() => handleSort("hr")} className="px-4 py-2" />
          <SortableHeader label="HR Corr" active={sortBy === "hrCorr"} direction={sortDir} onToggle={() => handleSort("hrCorr")} className="px-4 py-2" />
          <SortableHeader label="Output" active={sortBy === "output"} direction={sortDir} onToggle={() => handleSort("output")} className="px-4 py-2" />
          <SortableHeader label="EA" active={sortBy === "ea"} direction={sortDir} onToggle={() => handleSort("ea")} className="px-4 py-2" />
          <SortableHeader label="Pa:HR" active={sortBy === "paHr"} direction={sortDir} onToggle={() => handleSort("paHr")} className="px-4 py-2" />
          <SortableHeader label="Dérive FC" active={sortBy === "drift"} direction={sortDir} onToggle={() => handleSort("drift")} className="px-4 py-2" />
          <SortableHeader label="Coût" active={sortBy === "cost"} direction={sortDir} onToggle={() => handleSort("cost")} className="px-4 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Summary row */}
        <tr
          className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Icon name={expanded ? "expand_less" : "expand_more"} className="text-lg text-slate-400" />
              <span>1–{summary.count}</span>
              <Badge variant="slate">{summary.count} reps</Badge>
            </div>
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.totalDuration != null ? formatDuration(summary.totalDuration) : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.avgPace)}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-accent-orange">
            {summary.avgHr != null ? `${summary.avgHr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-violet-600 dark:text-violet-400">
            {summary.avgHrCorr != null ? `${summary.avgHrCorr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatOutput(summary.avgOutput)}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgEa != null ? summary.avgEa.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgPaHr != null ? summary.avgPaHr.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.globalDrift != null ? `${summary.globalDrift > 0 ? "+" : ""}${summary.globalDrift.toFixed(1)}%` : "--"}
          </td>
          <td className="whitespace-nowrap px-4 py-2">
            <CostBadge level={summary.costBadge} />
          </td>
        </tr>

        {/* Detail rows */}
        {expanded && sorted.map((row) => (
          <tr key={row.index} className="bg-blue-50/30 dark:bg-slate-800/30">
            <td className="whitespace-nowrap px-4 py-1.5 pl-10 text-xs font-medium text-slate-500 dark:text-slate-400">
              #{row.index}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.duration != null ? formatDuration(row.duration) : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs font-semibold text-accent-blue">
              {formatPace(row.pace)}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-accent-orange">
              {row.hr != null ? `${row.hr} bpm` : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-violet-600 dark:text-violet-400">
              {row.hrCorr != null ? `${row.hrCorr} bpm` : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs font-semibold text-accent-blue">
              {formatOutput(row.output)}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.ea != null ? row.ea.toFixed(3) : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.paHr != null ? row.paHr.toFixed(3) : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.driftPercent != null ? `${row.driftPercent > 0 ? "+" : ""}${row.driftPercent.toFixed(1)}%` : "--"}
            </td>
            <td className="whitespace-nowrap px-4 py-1.5">
              <CostBadge level={row.costBadge} size="xs" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Shared cost badge ──

function CostBadge({ level, size = "sm" }: { level: CostLevel; size?: "sm" | "xs" }) {
  if (!level) return <span className={`text-${size} text-slate-400`}>--</span>;
  return (
    <Badge variant={COST_CONFIG[level].variant}>
      {COST_CONFIG[level].label}
    </Badge>
  );
}
