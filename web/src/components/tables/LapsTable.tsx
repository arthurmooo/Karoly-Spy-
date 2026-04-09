import type { GarminLap, StreamPoint } from "@/types/activity";
import { useMemo, useState } from "react";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { formatDuration, speedToPace, speedToSwimPace } from "@/services/format.service";
import { formatPowerWatts, getStreamPowerForRange, isBikeSport, isSwimSport } from "@/services/activity.service";

const DEFAULT_SORT_BY = "lap";
const DEFAULT_SORT_DIR: SortDirection = "asc";

interface Props {
  laps: GarminLap[];
  sportType: string;
  streams?: StreamPoint[] | null;
}

function normalizeDisplayedCadence(cadence: number | null | undefined, isBike: boolean): number | null {
  if (cadence == null) return null;
  if (isBike) return cadence;
  return cadence <= 130 ? cadence * 2 : cadence;
}

function formatDist(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

function formatSpeed(ms: number): string {
  if (!ms || ms <= 0) return "--";
  return `${(ms * 3.6).toFixed(1)} km/h`;
}

export function LapsTable({ laps, sportType, streams }: Props) {
  const isBike = isBikeSport(sportType);
  const isSwim = isSwimSport(sportType);
  const [sortBy, setSortBy] = useState<"lap" | "duration" | "distance" | "speed" | "power" | "powerWithZeros" | "avg_hr" | "max_hr" | "cadence">(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);

  const powerWithZerosByLap = useMemo(
    () =>
      Object.fromEntries(
        laps.map((lap) => [
          lap.lap_n,
          getStreamPowerForRange(
            streams,
            lap.start_sec,
            lap.start_sec + lap.duration_sec,
            "elapsed_t",
            true
          ),
        ])
      ),
    [laps, streams]
  );

  const sortedLaps = sortRows(
    laps,
    (lap) => {
      switch (sortBy) {
        case "duration":
          return lap.duration_sec;
        case "distance":
          return lap.distance_m;
        case "speed":
          return lap.avg_speed;
        case "power":
          return lap.avg_power;
        case "powerWithZeros":
          return powerWithZerosByLap[lap.lap_n] ?? null;
        case "avg_hr":
          return lap.avg_hr;
        case "max_hr":
          return lap.max_hr;
        case "cadence":
          return normalizeDisplayedCadence(lap.avg_cadence, isBike);
        case "lap":
        default:
          return lap.lap_n;
      }
    },
    sortDir
  );

  const handleSort = (column: typeof sortBy) => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir("asc");
      return;
    }

    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }

    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <SortableHeader label="Lap" active={sortBy === "lap"} direction={sortDir} onToggle={() => handleSort("lap")} />
            <SortableHeader label="Durée" active={sortBy === "duration"} direction={sortDir} onToggle={() => handleSort("duration")} />
            <SortableHeader label="Distance" active={sortBy === "distance"} direction={sortDir} onToggle={() => handleSort("distance")} />
            <SortableHeader label={isBike ? "Vitesse" : "Allure"} active={sortBy === "speed"} direction={sortDir} onToggle={() => handleSort("speed")} />
            {isBike && <SortableHeader label="P sans 0" active={sortBy === "power"} direction={sortDir} onToggle={() => handleSort("power")} />}
            {isBike && <SortableHeader label="P avec 0" active={sortBy === "powerWithZeros"} direction={sortDir} onToggle={() => handleSort("powerWithZeros")} />}
            <SortableHeader label="FC Moy" active={sortBy === "avg_hr"} direction={sortDir} onToggle={() => handleSort("avg_hr")} />
            <SortableHeader label="FC Max" active={sortBy === "max_hr"} direction={sortDir} onToggle={() => handleSort("max_hr")} />
            <SortableHeader label="Cadence" active={sortBy === "cadence"} direction={sortDir} onToggle={() => handleSort("cadence")} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedLaps.map((lap) => (
            <tr key={lap.lap_n} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white">
                {lap.lap_n}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.duration_sec ? formatDuration(lap.duration_sec) : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.distance_m ? formatDist(lap.distance_m) : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.avg_speed
                  ? isBike
                    ? formatSpeed(lap.avg_speed)
                    : isSwim
                      ? speedToSwimPace(lap.avg_speed)
                      : speedToPace(lap.avg_speed)
                  : "--"}
              </td>
              {isBike && (
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                  {formatPowerWatts(lap.avg_power ?? null)}
                </td>
              )}
              {isBike && (
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                  {formatPowerWatts(powerWithZerosByLap[lap.lap_n] ?? null)}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.avg_hr ? `${lap.avg_hr} bpm` : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.max_hr ? `${lap.max_hr} bpm` : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {normalizeDisplayedCadence(lap.avg_cadence, isBike) ?? "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
