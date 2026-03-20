import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import type { Athlete } from "@/types/athlete";

interface AthleteSubNavProps {
  athlete: Athlete;
  active: "bilan" | "profile" | "trends";
}

const TABS = [
  {
    key: "bilan" as const,
    label: "Bilan",
    icon: "bar_chart",
    href: (id: string) => `/athletes/${id}/bilan`,
  },
  {
    key: "profile" as const,
    label: "Profil",
    icon: "person",
    href: (id: string) => `/athletes/${id}/profile`,
  },
  {
    key: "trends" as const,
    label: "Santé & HRV",
    icon: "monitor_heart",
    href: (id: string) => `/athletes/${id}/trends`,
  },
];

export function AthleteSubNav({ athlete, active }: AthleteSubNavProps) {
  const initials = `${athlete.first_name.charAt(0)}${athlete.last_name.charAt(0)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/athletes" className="flex items-center gap-1 hover:text-primary transition-colors">
          <Icon name="arrow_back" className="text-base" />
          Athlètes
        </Link>
        <Icon name="chevron_right" className="text-sm text-slate-400" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary border border-primary/20 shrink-0">
            {initials}
          </div>
          <span className="font-medium text-slate-900 dark:text-white">
            {athlete.first_name} {athlete.last_name}
          </span>
        </div>
      </div>

      <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1 gap-0.5">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              to={tab.href(athlete.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Icon name={tab.icon} className="text-sm" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
