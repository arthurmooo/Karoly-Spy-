import { Card, CardContent } from "@/components/ui/Card";
import { formatDistance, formatDuration } from "@/services/format.service";
import { formatPaceOrPower, formatPowerWatts, getBikePowerMetrics, isBikeSport } from "@/services/activity.service";
import type { Activity } from "@/types/activity";

interface Props {
  activity: Activity;
}

export function ActivityKpiCards({ activity }: Props) {
  const isBike = isBikeSport(activity.sport_type ?? "");
  const primaryDuration = activity.moving_time_sec ?? activity.duration_sec;
  const durationStr = primaryDuration ? formatDuration(primaryDuration) : "--";
  const hasElapsedDiff = activity.moving_time_sec != null
    && activity.duration_sec != null
    && Math.abs(activity.duration_sec - activity.moving_time_sec) > 60;
  const distanceStr = activity.distance_m ? formatDistance(activity.distance_m) : "--";
  const mlsStr = activity.load_index != null ? activity.load_index.toFixed(1) : "--";
  const hrStr = activity.avg_hr != null ? `${Math.round(activity.avg_hr)} bpm` : "--";
  const avgSpeed = activity.distance_m && primaryDuration
    ? activity.distance_m / primaryDuration
    : null;
  const bikePowerMetrics = getBikePowerMetrics(activity);
  const paceStr = formatPaceOrPower(activity.sport_type ?? "", avgSpeed, bikePowerMetrics.powerWithoutZeros);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Card>
        <CardContent className="p-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Durée</p>
          <h3 className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">{durationStr}</h3>
          {hasElapsedDiff && (
            <p className="text-xs text-slate-400 mt-0.5">
              (total : {formatDuration(activity.duration_sec!)})
            </p>
          )}
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
            {isBike ? "Puissance" : "Allure Moy"}
          </p>
          {isBike ? (
            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-medium text-slate-500">P</p>
                <h3 className="font-mono text-2xl font-semibold text-accent-orange">
                  {formatPowerWatts(bikePowerMetrics.powerWithoutZeros)}
                </h3>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">P0</p>
                <p className="font-mono text-lg font-semibold text-slate-700 dark:text-slate-300">
                  {formatPowerWatts(bikePowerMetrics.powerWithZeros)}
                </p>
              </div>
            </div>
          ) : (
            <h3 className="font-mono text-2xl font-semibold text-accent-orange">{paceStr}</h3>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
