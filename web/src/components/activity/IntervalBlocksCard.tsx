import { Fragment, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import type { DisplayBlock } from "@/lib/activityBlocks";
import type { StreamPoint } from "@/types/activity";
import {
  formatDuration,
  formatPaceDecimal,
  formatSwimPaceDecimal,
  speedToPace,
  speedToSwimPace,
} from "@/services/format.service";
import { formatPowerWatts, getStreamPowerForRange, isBikeSport, isSwimSport } from "@/services/activity.service";

interface Props {
  displayBlocks: DisplayBlock[];
  sportType: string;
  hasResolvedBlocks: boolean;
  detectionSource: string | null;
  streams?: StreamPoint[] | null;
}

type SortCol = "label" | "duration" | "mean" | "last" | "hr_mean" | "hr_last" | "source";
const DEFAULT_SORT_BY: SortCol = "label";
const DEFAULT_DIR: SortDirection = "asc";

export function IntervalBlocksCard({ displayBlocks, sportType, hasResolvedBlocks, detectionSource, streams }: Props) {
  const isBike = isBikeSport(sportType);
  const isSwim = isSwimSport(sportType);
  const [sortBy, setSortBy] = useState<SortCol>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_DIR);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = sortRows(displayBlocks, (block) => {
    switch (sortBy) {
      case "duration": return block.durationSec;
      case "mean": return isBike ? block.powerMean : block.paceMean;
      case "last": return isBike ? block.powerLast : block.paceLast;
      case "hr_mean": return block.hrMean;
      case "hr_last": return block.hrLast;
      case "source": return block.source;
      default: return block.label;
    }
  }, sortDir);

  const handleSort = (col: SortCol) => {
    if (sortBy !== col) { setSortBy(col); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortBy(DEFAULT_SORT_BY); setSortDir(DEFAULT_DIR);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const rowPowerWithZeros = new Map(
    displayBlocks.flatMap((block) =>
      block.rows.map((row) => [
        row.id,
        getStreamPowerForRange(streams, row.startSec, row.endSec, "t", true),
      ] as const)
    )
  );

  function getBlockPowerWithZerosMean(block: DisplayBlock): number | null {
    let weightedSum = 0;
    let weight = 0;
    for (const row of block.rows) {
      const value = rowPowerWithZeros.get(row.id) ?? null;
      if (value != null && row.durationSec != null) {
        weightedSum += value * row.durationSec;
        weight += row.durationSec;
      }
    }
    return weight > 0 ? weightedSum / weight : null;
  }

  function getBlockPowerWithZerosLast(block: DisplayBlock): number | null {
    const lastRow = block.rows[block.rows.length - 1];
    return lastRow ? (rowPowerWithZeros.get(lastRow.id) ?? null) : null;
  }

  return (
    <Card>
      <CardContent className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Icon name="format_list_numbered" className="text-slate-400" />
            Intervalles / Laps
          </h2>
          <Badge variant={hasResolvedBlocks ? "emerald" : "slate"}>
            {hasResolvedBlocks ? "Depuis segmented_metrics" : "Depuis activity_intervals"}
          </Badge>
        </div>

        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <SortableHeader label="Bloc" active={sortBy === "label"} direction={sortDir} onToggle={() => handleSort("label")} className="px-6 py-3" />
                  <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} className="px-6 py-3" />
                  <SortableHeader label={isBike ? "P moy" : "Allure Moy"} active={sortBy === "mean"} direction={sortDir} onToggle={() => handleSort("mean")} className="px-6 py-3 text-accent-orange" />
                  {isBike && <th className="px-6 py-3 text-accent-orange">P0 moy</th>}
                  <SortableHeader label={isBike ? "P last" : "Allure Last"} active={sortBy === "last"} direction={sortDir} onToggle={() => handleSort("last")} className="px-6 py-3" />
                  {isBike && <th className="px-6 py-3">P0 last</th>}
                  <SortableHeader label="FC Moy" active={sortBy === "hr_mean"} direction={sortDir} onToggle={() => handleSort("hr_mean")} className="px-6 py-3 text-accent-orange" />
                  <SortableHeader label="FC Last" active={sortBy === "hr_last"} direction={sortDir} onToggle={() => handleSort("hr_last")} className="px-6 py-3" />
                  <SortableHeader label="Source" active={sortBy === "source"} direction={sortDir} onToggle={() => handleSort("source")} className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((block) => {
                  const hasSubRows = block.count != null && block.count > 1 && block.rows.length > 0;
                  const isExpanded = expanded.has(block.id);
                  return (
                    <Fragment key={block.id}>
                      <tr className={hasSubRows ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""} onClick={hasSubRows ? () => toggle(block.id) : undefined}>
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            {hasSubRows && <Icon name={isExpanded ? "expand_less" : "expand_more"} className="text-lg text-slate-400" />}
                            <span>{block.label}</span>
                            {block.count != null && block.count > 1 && <Badge variant="slate">{block.count} reps</Badge>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{block.durationSec != null ? formatDuration(block.durationSec) : "--"}</td>
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-sm font-semibold text-accent-orange">{isBike ? formatPowerWatts(block.powerMean) : (block.paceMean != null ? (isSwim ? formatSwimPaceDecimal(block.paceMean / 10) : formatPaceDecimal(block.paceMean)) : "--")}</td>
                        {isBike && <td className="whitespace-nowrap px-6 py-3 font-mono text-sm font-semibold text-accent-orange">{formatPowerWatts(getBlockPowerWithZerosMean(block))}</td>}
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{isBike ? formatPowerWatts(block.powerLast) : (block.paceLast != null ? (isSwim ? formatSwimPaceDecimal(block.paceLast / 10) : formatPaceDecimal(block.paceLast)) : "--")}</td>
                        {isBike && <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{formatPowerWatts(getBlockPowerWithZerosLast(block))}</td>}
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-sm font-semibold text-accent-orange">{block.hrMean != null ? `${Math.round(block.hrMean)} bpm` : "--"}</td>
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{block.hrLast != null ? `${Math.round(block.hrLast)} bpm` : "--"}</td>
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-500">{block.source ?? detectionSource ?? "--"}</td>
                      </tr>
                      {hasSubRows && isExpanded && block.rows.map((row, i) => (
                        <tr key={row.id} className="bg-blue-50/30 dark:bg-slate-800/30">
                          <td className="whitespace-nowrap py-2 pl-14 pr-6 text-xs text-slate-500 dark:text-slate-400">#{i + 1}</td>
                          <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{row.durationSec != null ? formatDuration(row.durationSec) : "--"}</td>
                          <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{isBike ? formatPowerWatts(row.avgPower) : (row.avgSpeed ? (isSwim ? speedToSwimPace(row.avgSpeed) : speedToPace(row.avgSpeed)) : "--")}</td>
                          {isBike && <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{formatPowerWatts(rowPowerWithZeros.get(row.id) ?? null)}</td>}
                          <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-400" />
                          {isBike && <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-400" />}
                          <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{row.avgHr != null ? `${Math.round(row.avgHr)} bpm` : "--"}</td>
                          <td className="whitespace-nowrap px-6 py-2 font-mono text-xs text-slate-400">{row.avgCadence != null ? `${Math.round(row.avgCadence)} rpm` : ""}</td>
                          <td className="whitespace-nowrap px-6 py-2 text-xs text-slate-400">{row.source ?? ""}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
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
            Source de détection : {detectionSource ?? "non renseignée"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
