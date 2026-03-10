import type { GarminLap } from "@/types/activity";

interface Props {
  laps: GarminLap[];
  sportType: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

function formatDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDist(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

function formatPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

function formatSpeed(ms: number): string {
  if (!ms || ms <= 0) return "--";
  return `${(ms * 3.6).toFixed(1)} km/h`;
}

export function LapsTable({ laps, sportType }: Props) {
  const isBike = BIKE_SPORTS.has(sportType);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <th className="px-4 py-3">Lap</th>
            <th className="px-4 py-3">Durée</th>
            <th className="px-4 py-3">Distance</th>
            <th className="px-4 py-3">{isBike ? "Vitesse" : "Allure"}</th>
            {isBike && <th className="px-4 py-3">Puissance</th>}
            <th className="px-4 py-3">FC Moy</th>
            <th className="px-4 py-3">FC Max</th>
            <th className="px-4 py-3">Cadence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {laps.map((lap) => (
            <tr key={lap.lap_n} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white">
                {lap.lap_n}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.duration_sec ? formatDur(lap.duration_sec) : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.distance_m ? formatDist(lap.distance_m) : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.avg_speed
                  ? isBike
                    ? formatSpeed(lap.avg_speed)
                    : formatPace(lap.avg_speed)
                  : "--"}
              </td>
              {isBike && (
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                  {lap.avg_power ? `${lap.avg_power} W` : "--"}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.avg_hr ? `${lap.avg_hr} bpm` : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.max_hr ? `${lap.max_hr} bpm` : "--"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                {lap.avg_cadence ?? "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
