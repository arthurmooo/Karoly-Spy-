import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { buildActivityLinkState, getActivityDetailPath } from "@/lib/activityNavigation";
import { formatDistance, formatDuration } from "@/services/format.service";
import { getFormAnalysisHeartRateKpi } from "@/services/formAnalysisComparable.service";
import type { FormAnalysisComparableActivity } from "@/types/activity";

interface Props {
  open: boolean;
  onClose: () => void;
  activities: FormAnalysisComparableActivity[];
  isLoading: boolean;
  errorMessage?: string | null;
}

function formatOutput(activity: FormAnalysisComparableActivity): string {
  const output = activity.form_analysis?.output;
  if (output?.mean == null) return "Output —";
  return `${output.mean.toFixed(1)}${output.unit ? ` ${output.unit}` : ""}`;
}

function formatDecoupling(activity: FormAnalysisComparableActivity): string {
  const value = activity.form_analysis?.decoupling?.today;
  if (value == null) return "Déc. —";
  const sign = value > 0 ? "+" : "";
  return `Déc. ${sign}${value.toFixed(1)}%`;
}

function formatTemperature(activity: FormAnalysisComparableActivity): string {
  const temp = activity.form_analysis?.temperature?.temp ?? activity.temp_avg;
  return temp != null ? `${temp.toFixed(1)} °C` : "—";
}

function formatHeartRate(activity: FormAnalysisComparableActivity): string {
  const hrKpi = getFormAnalysisHeartRateKpi(activity.form_analysis);
  if (hrKpi.value == null) return `${hrKpi.label} —`;
  return `${hrKpi.label} ${hrKpi.value.toFixed(1)} bpm`;
}

function getTitle(activity: FormAnalysisComparableActivity): string {
  return activity.manual_activity_name || activity.activity_name || "Séance";
}

export function FormAnalysisComparableSessionsDialog({
  open,
  onClose,
  activities,
  isLoading,
  errorMessage,
}: Props) {
  const location = useLocation();
  const { role } = useAuth();
  const detailState = buildActivityLinkState(location);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Séances comparables</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Séances retenues par la logique d&apos;analyse de forme pour cette comparaison.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
          <Icon name="close" />
        </Button>
      </DialogHeader>

      <DialogBody className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            Chargement des séances comparables...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {errorMessage}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            Aucune séance comparable reconstituée.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const path = getActivityDetailPath(activity.id, role);
              const distance = activity.distance_m != null ? formatDistance(activity.distance_m) : "--";
              const duration = formatDuration(activity.moving_time_sec ?? activity.duration_sec ?? 0);

              return (
                <Link
                  key={activity.id}
                  to={path}
                  state={detailState}
                  className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all duration-150 hover:border-primary hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-400 dark:hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {new Date(activity.session_date).toLocaleDateString("fr-FR")} · {getTitle(activity)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {distance} · {duration}
                      </p>
                    </div>
                    <Icon name="chevron_right" className="mt-0.5 text-slate-400" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{formatHeartRate(activity)}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{formatOutput(activity)}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{formatDecoupling(activity)}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">Temp. {formatTemperature(activity)}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">RPE {activity.rpe != null ? activity.rpe.toFixed(1) : "—"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DialogBody>

      <DialogFooter className="justify-end">
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
