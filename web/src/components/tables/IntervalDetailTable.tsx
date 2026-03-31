import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Card, CardContent } from "@/components/ui/Card";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import type { BlockGroupedIntervals, ActivityInterval, RepWindow } from "@/types/activity";
import { formatDuration, formatPaceDecimal, speedToPaceDecimal } from "@/services/format.service";
import { cn } from "@/lib/cn";

interface Props {
  intervalsByBlock: BlockGroupedIntervals[];
  sportType: string;
  repWindowsByBlock: Record<number, RepWindow[]>;
  hasManualWindows?: boolean;
  expandedBlocks?: Set<number>;
  onToggleBlock?: (blockIndex: number) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
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
  pace: number | null;
  hr: number | null;
  hrCorr: number | null;
  output: number | null;
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

export type ViewMode = "intervals" | "windows";

// ── Computation helpers ──

function computeRows(intervals: ActivityInterval[], isBike: boolean): RowData[] {
  const active = intervals.filter((i) => i.type === "work" || i.type === "active");
  if (active.length === 0) return [];
  const firstHr = active[0]!.avg_hr;
  return active.map((intv, i) => {
    const paceOrPower = isBike
      ? intv.avg_power ?? null
      : intv.avg_speed && intv.avg_speed > 0
        ? speedToPaceDecimal(intv.avg_speed)
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
      index: i + 1, duration: intv.duration ?? null, paceOrPower,
      paceOrPowerLast: null, hr: intv.avg_hr != null ? Math.round(intv.avg_hr) : null,
      hrLast: null, paHr, driftPercent, costBadge: getCostBadge(driftPercent),
    };
  });
}

function computeSummary(rows: RowData[]): SummaryData | null {
  if (rows.length === 0) return null;
  const count = rows.length;
  const durValues = rows.filter((r) => r.duration != null).map((r) => r.duration!);
  const totalDuration = durValues.length > 0 ? durValues.reduce((a, b) => a + b, 0) : null;

  let avgPaceOrPower: number | null = null;
  if (totalDuration && totalDuration > 0) {
    let ws = 0, wt = 0;
    for (const r of rows) { if (r.paceOrPower != null && r.duration != null) { ws += r.paceOrPower * r.duration; wt += r.duration; } }
    if (wt > 0) avgPaceOrPower = ws / wt;
  }

  let avgHr: number | null = null;
  if (totalDuration && totalDuration > 0) {
    let ws = 0, wt = 0;
    for (const r of rows) { if (r.hr != null && r.duration != null) { ws += r.hr * r.duration; wt += r.duration; } }
    if (wt > 0) avgHr = Math.round(ws / wt);
  }

  const paHrValues = rows.filter((r) => r.paHr != null).map((r) => r.paHr!);
  const avgPaHr = paHrValues.length > 0 ? paHrValues.reduce((a, b) => a + b, 0) / paHrValues.length : null;
  const lastRow = rows[rows.length - 1]!;
  const globalDrift = lastRow.driftPercent;

  return {
    count, totalDuration, avgPaceOrPower, avgHr,
    paceOrPowerLast: lastRow.paceOrPower, hrLast: lastRow.hr,
    avgPaHr, globalDrift, costBadge: getCostBadge(globalDrift),
  };
}

function computeWindowRows(repWindows: RepWindow[], isBike: boolean): WindowRow[] {
  if (!repWindows || repWindows.length === 0) return [];
  const firstHr = repWindows[0]!.hr_raw;
  return repWindows.map((w) => {
    const pace = w.output != null && w.output > 0
      ? isBike ? Math.round(w.output) : 60 / w.output
      : null;
    const hrRef = w.hr_corr ?? w.hr_raw;
    const paHr = w.output != null && hrRef != null && hrRef > 0 ? w.output / hrRef : null;
    const driftPercent = firstHr != null && firstHr > 0 && w.hr_raw != null
      ? ((w.hr_raw - firstHr) / firstHr) * 100 : null;
    return {
      index: w.rep_index, duration: w.duration_sec ?? null, pace,
      hr: w.hr_raw != null ? Math.round(w.hr_raw) : null,
      hrCorr: w.hr_corr != null ? Math.round(w.hr_corr) : null,
      output: w.output ?? null, ea: w.ea ?? null, paHr, driftPercent,
      costBadge: getCostBadge(driftPercent),
    };
  });
}

function computeWindowSummary(windowRows: WindowRow[]): WindowSummary | null {
  if (windowRows.length === 0) return null;
  const count = windowRows.length;
  const durValues = windowRows.filter((r) => r.duration != null).map((r) => r.duration!);
  const totalDuration = durValues.length > 0 ? durValues.reduce((a, b) => a + b, 0) : null;

  function durationWeighted(getter: (r: WindowRow) => number | null): number | null {
    if (!totalDuration || totalDuration <= 0) return null;
    let ws = 0, wt = 0;
    for (const r of windowRows) { const v = getter(r); if (v != null && r.duration != null) { ws += v * r.duration; wt += r.duration; } }
    return wt > 0 ? ws / wt : null;
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
    count, totalDuration, avgPace, avgHr, avgHrCorr, avgOutput, avgEa,
    avgPaHr, globalDrift, costBadge: getCostBadge(globalDrift),
  };
}

// ── Segmented control ──

const VIEW_MODE_TABS = [
  { key: "intervals" as const, label: "Intervalles" },
  { key: "windows" as const, label: "Fenêtres stab." },
];

function SegmentedControl({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return <SlidingTabs items={VIEW_MODE_TABS} value={value} onChange={onChange} size="sm" rounded="lg" />;
}

// ── Main component ──

export function IntervalDetailTable({
  intervalsByBlock,
  sportType,
  repWindowsByBlock,
  hasManualWindows,
  expandedBlocks: externalExpanded,
  onToggleBlock,
  view,
  onViewChange,
}: Props) {
  const isBike = BIKE_SPORTS.has(sportType);
  const [sortBy, setSortBy] = useState<SortCol>("index");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [internalExpanded, setInternalExpanded] = useState<Set<number>>(new Set());
  const expandedBlocks = externalExpanded ?? internalExpanded;
  const multiBlock = intervalsByBlock.length > 1;

  // ── Per-block interval data ──
  const blockData = useMemo(() =>
    intervalsByBlock.map((group) => {
      const rows = computeRows(group.intervals, isBike);
      const summary = computeSummary(rows);
      return { blockIndex: group.blockIndex, label: group.label, rows, summary };
    }),
    [intervalsByBlock, isBike]
  );

  // ── Per-block window data ──
  const blockWindowData = useMemo(() =>
    intervalsByBlock.map((group) => {
      const windows = repWindowsByBlock[group.blockIndex] ?? [];
      const rows = computeWindowRows(windows, isBike);
      const summary = computeWindowSummary(rows);
      return { blockIndex: group.blockIndex, label: group.label, rows, summary };
    }),
    [intervalsByBlock, repWindowsByBlock, isBike]
  );

  const hasAnyIntervals = blockData.some((b) => b.summary != null);
  if (!hasAnyIntervals) return null;

  const handleSort = (col: SortCol) => {
    if (sortBy !== col) { setSortBy(col); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortBy("index"); setSortDir("asc"); }
  };

  const toggleBlock = onToggleBlock ?? ((blockIndex: number) => {
    setInternalExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(blockIndex)) next.delete(blockIndex); else next.add(blockIndex);
      return next;
    });
  });

  function formatPace(val: number | null): string {
    if (val == null) return "--";
    return isBike ? `${Math.round(val)} W` : formatPaceDecimal(val);
  }

  function formatOutput(val: number | null): string {
    if (val == null) return "--";
    if (isBike) return `${Math.round(val)} W`;
    return val > 0 ? formatPaceDecimal(60 / val) : "--";
  }

  const handleViewChange = (v: ViewMode) => {
    onViewChange(v);
    setSortBy("index");
    setSortDir("asc");
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon name="table_chart" className="text-base text-slate-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Détail par répétition
          </span>
        </div>
        <SegmentedControl value={view} onChange={handleViewChange} />
      </div>

      <CardContent className="overflow-hidden p-0">
        {view === "intervals" ? (
          <div>
            {blockData.map((block) => {
              if (!block.summary) return null;
              const sorted = sortRows(block.rows, (row) => {
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
              }, sortDir);
              return (
                <IntervalBlockView
                  key={block.blockIndex}
                  blockIndex={block.blockIndex}
                  label={block.label}
                  summary={block.summary}
                  sorted={sorted}
                  expanded={expandedBlocks.has(block.blockIndex)}
                  onToggle={() => toggleBlock(block.blockIndex)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  handleSort={handleSort}
                  isBike={isBike}
                  formatPace={formatPace}
                  multiBlock={multiBlock}
                />
              );
            })}
          </div>
        ) : (
          <div>
            {hasManualWindows && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-orange-50 px-4 py-2 dark:border-slate-800 dark:bg-orange-900/20">
                <Icon name="info" className="text-orange-600 dark:text-orange-400 text-sm" />
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Fenêtres calculées localement (sans correction thermique)
                </p>
              </div>
            )}
            {blockWindowData.map((block) => {
              if (!block.summary) return null;
              const sorted = sortRows(block.rows, (row) => {
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
              }, sortDir);
              return (
                <WindowBlockView
                  key={block.blockIndex}
                  blockIndex={block.blockIndex}
                  label={block.label}
                  summary={block.summary}
                  sorted={sorted}
                  expanded={expandedBlocks.has(block.blockIndex)}
                  onToggle={() => toggleBlock(block.blockIndex)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  handleSort={handleSort}
                  isBike={isBike}
                  formatPace={formatPace}
                  formatOutput={formatOutput}
                  multiBlock={multiBlock}
                />
              );
            })}
            {blockWindowData.every((b) => !b.summary) && (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
                <Icon name="info" className="text-slate-400 shrink-0" />
                <span>
                  Fenêtres stabilisées non disponibles pour cette séance.
                  Relancez le recalcul pour les calculer.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Interval block view ──

const INTERVAL_COL_COUNT = 9;

function IntervalBlockView({
  blockIndex, label, summary, sorted, expanded, onToggle,
  sortBy, sortDir, handleSort, isBike, formatPace, multiBlock,
}: {
  blockIndex: number;
  label: string;
  summary: SummaryData;
  sorted: RowData[];
  expanded: boolean;
  onToggle: () => void;
  sortBy: SortCol;
  sortDir: SortDirection;
  handleSort: (col: SortCol) => void;
  isBike: boolean;
  formatPace: (v: number | null) => string;
  multiBlock: boolean;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <SortableHeader label="#" active={sortBy === "index"} direction={sortDir} onToggle={() => handleSort("index")} className="px-3 py-2" />
          <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-3 py-2" />
          <SortableHeader label={isBike ? "Puiss. Moy" : "Allure Moy"} active={sortBy === "paceOrPower"} direction={sortDir} onToggle={() => handleSort("paceOrPower")} className="px-3 py-2" />
          <SortableHeader label={isBike ? "Puiss. Last" : "Allure Last"} active={sortBy === "paceOrPowerLast"} direction={sortDir} onToggle={() => handleSort("paceOrPowerLast")} className="px-3 py-2" />
          <SortableHeader label="FC Moy" active={sortBy === "hr"} direction={sortDir} onToggle={() => handleSort("hr")} className="px-3 py-2" />
          <SortableHeader label="FC Last" active={sortBy === "hrLast"} direction={sortDir} onToggle={() => handleSort("hrLast")} className="px-3 py-2" />
          <SortableHeader label="Pa:HR" active={sortBy === "paHr"} direction={sortDir} onToggle={() => handleSort("paHr")} className="px-3 py-2" />
          <SortableHeader label="Dérive FC" active={sortBy === "drift"} direction={sortDir} onToggle={() => handleSort("drift")} className="px-3 py-2" />
          <SortableHeader label="Coût" active={sortBy === "cost"} direction={sortDir} onToggle={() => handleSort("cost")} className="px-3 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Summary row */}
        <tr
          className="group cursor-pointer bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all duration-150"
          onClick={onToggle}
        >
          <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200/70 dark:bg-slate-700/50 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-all duration-150">
                <Icon name="expand_more" className={cn("text-sm text-slate-500 transition-transform duration-200", expanded && "rotate-180")} />
              </span>
              {multiBlock && (
                <Badge variant="primary" className="mr-1">{label}</Badge>
              )}
              <span>1–{summary.count}</span>
              <Badge variant="slate">{summary.count} reps</Badge>
            </div>
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.totalDuration != null ? formatDuration(summary.totalDuration) : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.avgPaceOrPower)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.paceOrPowerLast)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-accent-orange">
            {summary.avgHr != null ? `${summary.avgHr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-accent-orange">
            {summary.hrLast != null ? `${summary.hrLast} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgPaHr != null ? summary.avgPaHr.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.globalDrift != null ? `${summary.globalDrift > 0 ? "+" : ""}${summary.globalDrift.toFixed(1)}%` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            <CostBadge level={summary.costBadge} />
          </td>
        </tr>

        {/* Animated detail rows */}
        <tr>
          <td colSpan={INTERVAL_COL_COUNT} className="p-0 border-none">
            <div className={cn(
              "grid transition-all duration-300 ease-in-out",
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sorted.map((row) => (
                      <tr key={`${blockIndex}-${row.index}`} className="bg-slate-50/40 dark:bg-slate-800/20">
                        <td className="whitespace-nowrap px-3 py-1.5 pl-10 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <div className="flex items-center">
                            <span className="inline-block w-0.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 mr-2" />
                            #{row.index}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.duration != null ? formatDuration(row.duration) : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-semibold text-accent-blue">
                          {formatPace(row.paceOrPower)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5" />
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-accent-orange">
                          {row.hr != null ? `${row.hr} bpm` : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5" />
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.paHr != null ? row.paHr.toFixed(3) : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.driftPercent != null ? `${row.driftPercent > 0 ? "+" : ""}${row.driftPercent.toFixed(1)}%` : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <CostBadge level={row.costBadge} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Window block view ──

const WINDOW_COL_COUNT = 10;

function WindowBlockView({
  blockIndex, label, summary, sorted, expanded, onToggle,
  sortBy, sortDir, handleSort, isBike, formatPace, formatOutput, multiBlock,
}: {
  blockIndex: number;
  label: string;
  summary: WindowSummary;
  sorted: WindowRow[];
  expanded: boolean;
  onToggle: () => void;
  sortBy: SortCol;
  sortDir: SortDirection;
  handleSort: (col: SortCol) => void;
  isBike: boolean;
  formatPace: (v: number | null) => string;
  formatOutput: (v: number | null) => string;
  multiBlock: boolean;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          <SortableHeader label="#" active={sortBy === "index"} direction={sortDir} onToggle={() => handleSort("index")} className="px-3 py-2" />
          <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-3 py-2" />
          <SortableHeader label={isBike ? "Puissance" : "Allure"} active={sortBy === "paceOrPower"} direction={sortDir} onToggle={() => handleSort("paceOrPower")} className="px-3 py-2" />
          <SortableHeader label="FC" active={sortBy === "hr"} direction={sortDir} onToggle={() => handleSort("hr")} className="px-3 py-2" />
          <SortableHeader label="HR Corr" active={sortBy === "hrCorr"} direction={sortDir} onToggle={() => handleSort("hrCorr")} className="px-3 py-2" />
          <SortableHeader label="Output" active={sortBy === "output"} direction={sortDir} onToggle={() => handleSort("output")} className="px-3 py-2" />
          <SortableHeader label="EA" active={sortBy === "ea"} direction={sortDir} onToggle={() => handleSort("ea")} className="px-3 py-2" />
          <SortableHeader label="Pa:HR" active={sortBy === "paHr"} direction={sortDir} onToggle={() => handleSort("paHr")} className="px-3 py-2" />
          <SortableHeader label="Dérive FC" active={sortBy === "drift"} direction={sortDir} onToggle={() => handleSort("drift")} className="px-3 py-2" />
          <SortableHeader label="Coût" active={sortBy === "cost"} direction={sortDir} onToggle={() => handleSort("cost")} className="px-3 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        <tr
          className="group cursor-pointer bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all duration-150"
          onClick={onToggle}
        >
          <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200/70 dark:bg-slate-700/50 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-all duration-150">
                <Icon name="expand_more" className={cn("text-sm text-slate-500 transition-transform duration-200", expanded && "rotate-180")} />
              </span>
              {multiBlock && (
                <Badge variant="primary" className="mr-1">{label}</Badge>
              )}
              <span>1–{summary.count}</span>
              <Badge variant="slate">{summary.count} reps</Badge>
            </div>
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.totalDuration != null ? formatDuration(summary.totalDuration) : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatPace(summary.avgPace)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-accent-orange">
            {summary.avgHr != null ? `${summary.avgHr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-accent-orange/70">
            {summary.avgHrCorr != null ? `${summary.avgHrCorr} bpm` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold text-accent-blue">
            {formatOutput(summary.avgOutput)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgEa != null ? summary.avgEa.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.avgPaHr != null ? summary.avgPaHr.toFixed(3) : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-slate-600 dark:text-slate-400">
            {summary.globalDrift != null ? `${summary.globalDrift > 0 ? "+" : ""}${summary.globalDrift.toFixed(1)}%` : "--"}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            <CostBadge level={summary.costBadge} />
          </td>
        </tr>

        <tr>
          <td colSpan={WINDOW_COL_COUNT} className="p-0 border-none">
            <div className={cn(
              "grid transition-all duration-300 ease-in-out",
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sorted.map((row) => (
                      <tr key={`${blockIndex}-w-${row.index}`} className="bg-slate-50/40 dark:bg-slate-800/20">
                        <td className="whitespace-nowrap px-3 py-1.5 pl-10 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <div className="flex items-center">
                            <span className="inline-block w-0.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 mr-2" />
                            #{row.index}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.duration != null ? formatDuration(row.duration) : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-semibold text-accent-blue">
                          {formatPace(row.pace)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-accent-orange">
                          {row.hr != null ? `${row.hr} bpm` : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-accent-orange/70">
                          {row.hrCorr != null ? `${row.hrCorr} bpm` : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-semibold text-accent-blue">
                          {formatOutput(row.output)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.ea != null ? row.ea.toFixed(3) : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.paHr != null ? row.paHr.toFixed(3) : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {row.driftPercent != null ? `${row.driftPercent > 0 ? "+" : ""}${row.driftPercent.toFixed(1)}%` : "--"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <CostBadge level={row.costBadge} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
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
