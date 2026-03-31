import { Link } from "react-router-dom";
import { useLatestActivity } from "@/hooks/useLatestActivity";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";
import { mapSportLabel } from "@/services/activity.service";

interface Props {
  athleteId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function CoachFeedbackWidget({ athleteId }: Props) {
  const { activity, isLoading } = useLatestActivity(athleteId);
  const comment = activity?.coach_comment?.trim() || null;

  return (
    <WidgetShell
      title="Feedback coach"
      icon="chat"
      isLoading={isLoading}
      isEmpty={!comment}
      emptyMessage="Aucun commentaire récent"
    >
      {activity && comment && (
        <Link
          to={`/mon-espace/activities/${activity.id}`}
          className="block space-y-2 rounded-xl p-3 -mx-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Icon name="directions_run" className="text-sm" />
            <span>
              {mapSportLabel(activity.sport_type ?? "")} · {formatDate(activity.session_date)}
            </span>
          </div>
          <blockquote className="border-l-2 border-accent-blue pl-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {comment}
          </blockquote>
        </Link>
      )}
    </WidgetShell>
  );
}
