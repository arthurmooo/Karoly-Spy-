import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { SPORT_CONFIG } from "@/lib/constants";

type View = "week" | "month" | "year";

const VIEWS: { key: View; label: string; short: string }[] = [
  { key: "week", label: "Semaine", short: "S" },
  { key: "month", label: "Mois", short: "M" },
  { key: "year", label: "Année", short: "A" },
];

interface CalendarToolbarProps {
  view: View;
  currentDate: Date;
  onViewChange: (view: View) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onTodayClick: () => void;
  athletes: any[];
  selectedAthleteId: string | null;
  selectedSport: string | null;
  onAthleteChange: (id: string | null) => void;
  onSportChange: (sport: string | null) => void;
  hideAthleteFilter?: boolean;
}

const VIEW_TABS = VIEWS.map((v) => ({
  key: v.key,
  label: v.label,
  shortLabel: v.short,
}));

function ViewSwitcher({ view, onViewChange }: { view: View; onViewChange: (v: View) => void }) {
  return <SlidingTabs items={VIEW_TABS} value={view} onChange={onViewChange} rounded="lg" />;
}

export function CalendarToolbar({
  view,
  currentDate,
  onViewChange,
  onNavigate,
  onTodayClick,
  athletes,
  selectedAthleteId,
  selectedSport,
  onAthleteChange,
  onSportChange,
  hideAthleteFilter,
}: CalendarToolbarProps) {
  const getTitle = () => {
    if (view === "week") {
      return format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    } else if (view === "month") {
      return format(currentDate, "MMMM yyyy", { locale: fr });
    }
    return format(currentDate, "yyyy", { locale: fr });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-3 py-2.5 sm:px-4">
      {/* Main row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left — Navigation + Title + Today */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate("prev")}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <Icon name="chevron_left" className="text-lg" />
          </button>
          <button
            onClick={() => onNavigate("next")}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <Icon name="chevron_right" className="text-lg" />
          </button>

          <span className="text-base font-semibold text-slate-900 dark:text-white capitalize truncate">
            {getTitle()}
          </span>

          <button
            onClick={onTodayClick}
            className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors whitespace-nowrap shrink-0"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Center — Filters (desktop only) */}
        <div className="hidden lg:flex items-center gap-2">
          {!hideAthleteFilter && (
            <select
              value={selectedAthleteId || ""}
              onChange={(e) => onAthleteChange(e.target.value || null)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            >
              <option value="">Tous les athlètes</option>
              {athletes.map((ath) => (
                <option key={ath.id} value={ath.id}>
                  {ath.first_name} {ath.last_name}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedSport || "Tous les sports"}
            onChange={(e) => onSportChange(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
          >
            <option value="Tous les sports">Tous les sports</option>
            {SPORT_CONFIG.map((s) => (
              <option key={s.key} value={s.dbKey}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Right — View Switcher */}
        <div className="shrink-0 self-start lg:self-auto">
          <ViewSwitcher view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* Mobile/Tablet filters (below lg) */}
      <div className="mt-2.5 flex flex-col gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:flex-row lg:hidden">
        {!hideAthleteFilter && (
          <select
            value={selectedAthleteId || ""}
            onChange={(e) => onAthleteChange(e.target.value || null)}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
          >
            <option value="">Tous les athlètes</option>
            {athletes.map((ath) => (
              <option key={ath.id} value={ath.id}>
                {ath.first_name} {ath.last_name}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedSport || "Tous les sports"}
          onChange={(e) => onSportChange(e.target.value)}
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
        >
          <option value="Tous les sports">Tous les sports</option>
          {SPORT_CONFIG.map((s) => (
            <option key={s.key} value={s.dbKey}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
