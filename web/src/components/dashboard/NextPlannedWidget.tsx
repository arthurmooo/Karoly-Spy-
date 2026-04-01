import { Link } from "react-router-dom";
import { useNextPlannedWorkout } from "@/hooks/useNextPlannedWorkout";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { Icon } from "@/components/ui/Icon";
import { getSportConfig } from "@/lib/constants";

interface Props {
  athleteId: string;
}

function formatPlannedDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Aujourd'hui";
  if (isSameDay(date, tomorrow)) return "Demain";

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function NextPlannedWidget({ athleteId }: Props) {
  const { workout, isLoading } = useNextPlannedWorkout(athleteId);
  const sportCfg = workout ? getSportConfig(workout.sport ?? "") : null;

  return (
    <WidgetShell
      title="Prochaine séance"
      icon="event"
      isLoading={isLoading}
      isEmpty={!workout}
      emptyMessage="Aucune séance planifiée"
      headerAction={
        <Link
          to="/mon-espace/calendrier"
          className="text-xs font-medium text-accent-blue hover:underline"
        >
          Calendrier
        </Link>
      }
    >
      {workout && sportCfg && (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${sportCfg.bgLight}`}
            >
              <Icon name={sportCfg.icon} className={`text-lg ${sportCfg.textColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {workout.name || "Séance planifiée"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatPlannedDate(workout.planned_date)}
              </p>
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
