import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mapWorkTypeLabel } from "@/services/activity.service";
import type { Activity } from "@/types/activity";

interface Props {
  activity: Activity;
  onBack: () => void;
  onReprocess: () => Promise<{ success: boolean; error?: string } | undefined>;
  isReprocessing: boolean;
  reprocessLaunched: boolean;
  onReprocessLaunched: () => void;
  isCoach: boolean;
}

export function ActivityHeader({
  activity,
  onBack,
  onReprocess,
  isReprocessing,
  reprocessLaunched,
  onReprocessLaunched,
  isCoach,
}: Props) {
  const athleteName = activity.athletes
    ? `${activity.athletes.first_name} ${activity.athletes.last_name.charAt(0)}.`
    : "Inconnu";
  const title = activity.manual_activity_name || activity.activity_name || "Activité";
  const sessionDate = activity.session_date
    ? new Date(activity.session_date).toLocaleDateString("fr-FR")
    : "--";
  const hasFitFile = Boolean(activity.fit_file_path);
  const hasResolvedBlocks = Boolean(activity.segmented_metrics?.interval_blocks?.length);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" className="text-lg" />
        Retour aux activités
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
            {hasFitFile && <Badge variant="emerald">FIT stocké</Badge>}
            {hasResolvedBlocks && <Badge variant="primary">Blocs détectés</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Icon name="person" className="text-slate-400" />
              {athleteName}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-slate-500">
              <Icon name="calendar_today" className="text-slate-400" />
              {sessionDate}
            </span>
            <Badge variant="primary">{mapWorkTypeLabel(activity.work_type)}</Badge>
          </div>
        </div>
        {isCoach && hasFitFile && (
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isReprocessing}
              onClick={async () => {
                const result = await onReprocess();
                if (result?.success) {
                  onReprocessLaunched();
                }
              }}
            >
              {isReprocessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Icon name="refresh" />
              )}
              {isReprocessing ? "Recalcul..." : "Recalculer"}
            </Button>
            {reprocessLaunched && (
              <p className="text-[11px] text-slate-400">
                Rafraîchir dans ~3 min pour voir les nouvelles métriques
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
