import { Icon } from "@/components/ui/Icon";
import type { FocusAlert } from "@/services/analysis.service";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isCoach as checkIsCoach } from "@/lib/auth/roles";
import { getSportConfig } from "@/lib/constants";

interface FocusCoachProps {
  alert: FocusAlert;
}

export function FocusCoach({ alert }: FocusCoachProps) {
  const { role } = useAuth();
  const coach = checkIsCoach(role);

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800/60 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-100 p-2 dark:bg-red-900/40">
          <Icon name="warning" className="text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {alert.title}
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            {alert.message}
          </p>
          <ul className="mt-2 space-y-0.5">
            {alert.sessions.map((session) => {
              const path = coach
                ? `/activities/${session.id}`
                : `/mon-espace/activities/${session.id}`;
              return (
                <li key={session.id}>
                  <Link
                    to={path}
                    className="group flex items-center gap-2 text-xs text-red-600 dark:text-red-400 cursor-pointer rounded px-2 py-1 hover:bg-red-100/80 dark:hover:bg-red-900/30 transition-all duration-150"
                  >
                    <Icon name={getSportConfig(session.sportKey).icon} className="text-sm opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="flex-1 group-hover:text-red-700 dark:group-hover:text-red-300 transition-all duration-150">{session.name}</span>
                    <Icon name="chevron_right" className="text-xs opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all duration-150" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
