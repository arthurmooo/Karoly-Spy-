import { Link, useLocation } from "react-router-dom";
import { useLatestActivity } from "@/hooks/useLatestActivity";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { getSportConfig } from "@/lib/constants";
import { buildActivityLinkState } from "@/lib/activityNavigation";
import { mapSportLabel, mapWorkTypeLabel } from "@/services/activity.service";
import { formatDuration, formatDistance } from "@/services/format.service";

interface Props {
  athleteId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function LastSessionWidget({ athleteId }: Props) {
  const location = useLocation();
  const { activity, isLoading } = useLatestActivity(athleteId);
  const detailState = buildActivityLinkState(location);

  const sportCfg = activity ? getSportConfig(activity.sport_type ?? "") : null;
  const title = activity
    ? (activity.manual_activity_name || activity.activity_name || "Séance").trim()
    : "";

  return (
    <WidgetShell
      title="Dernière séance"
      icon="history"
      isLoading={isLoading}
      isEmpty={!activity}
      emptyMessage="Aucune séance enregistrée"
    >
      {activity && sportCfg && (
        <Link
          to={`/mon-espace/activities/${activity.id}`}
          state={detailState}
          className="block space-y-3 rounded-xl p-3 -mx-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon name={sportCfg.icon} className={`text-lg ${sportCfg.textColor}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(activity.session_date)} · {mapSportLabel(activity.sport_type ?? "")} · {mapWorkTypeLabel(activity.work_type)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Metric label="Durée" value={formatDuration(activity.moving_time_sec ?? activity.duration_sec ?? 0)} />
            <Metric label="Distance" value={formatDistance(activity.distance_m ?? 0)} />
            {activity.load_index != null && (
              <Metric label="Charge (MLS)" value={Math.round(activity.load_index).toLocaleString("fr-FR")} />
            )}
            {activity.rpe != null && (
              <Metric label="RPE" value={activity.rpe.toString()} />
            )}
          </div>

          {activity.avg_hr != null && (
            <div className="pt-1">
              <Badge variant="slate">
                <Icon name="favorite" className="text-[10px] mr-0.5" />
                {Math.round(activity.avg_hr)} bpm
              </Badge>
            </div>
          )}
        </Link>
      )}
    </WidgetShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
