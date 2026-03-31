import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { SPORT_CONFIG, getSportConfig } from "@/lib/constants";

type View = "week" | "month" | "year";

const VIEWS: { key: View; label: string; short: string }[] = [
  { key: "week", label: "Semaine", short: "S" },
  { key: "month", label: "Mois", short: "M" },
  { key: "year", label: "Année", short: "A" },
];

type DisplayMode = "all" | "planned" | "realized";

const DISPLAY_TABS: { key: DisplayMode; label: string; shortLabel: string }[] = [
  { key: "all", label: "Tout", shortLabel: "T" },
  { key: "planned", label: "Prévu", shortLabel: "P" },
  { key: "realized", label: "Réalisé", shortLabel: "R" },
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
  displayMode: DisplayMode;
  onAthleteChange: (id: string | null) => void;
  onSportChange: (sport: string | null) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
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
  displayMode,
  onAthleteChange,
  onSportChange,
  onDisplayModeChange,
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

  const sportIcon = selectedSport
    ? getSportConfig(selectedSport)?.icon ?? "exercise"
    : "exercise";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* ── Line 1: Header + Navigation ── */}
      <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title + Divider + Nav + Period + Today */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Icon name="calendar_month" className="text-xl text-accent-blue dark:text-blue-400 shrink-0" />
          <span className="hidden sm:inline text-base font-bold text-slate-900 dark:text-white">
            Calendrier
          </span>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />

          {/* Nav arrows */}
          <button
            onClick={() => onNavigate("prev")}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all shrink-0"
            aria-label="Période précédente"
          >
            <Icon name="chevron_left" className="text-xl" />
          </button>
          <button
            onClick={() => onNavigate("next")}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all shrink-0"
            aria-label="Période suivante"
          >
            <Icon name="chevron_right" className="text-xl" />
          </button>

          {/* Period title */}
          <span className="text-lg font-bold text-slate-900 dark:text-white capitalize truncate">
            {getTitle()}
          </span>

          {/* Today button */}
          <button
            onClick={onTodayClick}
            className="px-3 py-1.5 text-xs font-semibold bg-accent-blue text-white rounded-full hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95 transition-all shadow-sm whitespace-nowrap shrink-0"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Right: View switcher */}
        <div className="shrink-0">
          <ViewSwitcher view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* ── Line 2: Filters ── */}
      <div className="flex flex-col gap-2 px-3 py-2 sm:px-4 border-t border-slate-100 dark:border-slate-800 sm:flex-row sm:items-center sm:flex-wrap">
        <SlidingTabs items={DISPLAY_TABS} value={displayMode} onChange={onDisplayModeChange} size="sm" rounded="lg" />

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />

        {/* Sport select */}
        <div className="relative">
          <Icon
            name={sportIcon}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
          />
          <select
            value={selectedSport || "Tous les sports"}
            onChange={(e) => onSportChange(e.target.value)}
            className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue transition-colors cursor-pointer"
          >
            <option value="Tous les sports">Tous les sports</option>
            {SPORT_CONFIG.map((s) => (
              <option key={s.key} value={s.dbKey}>{s.label}</option>
            ))}
          </select>
          <Icon
            name="expand_more"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
          />
        </div>

        {/* Athlete select */}
        {!hideAthleteFilter && (
          <div className="relative">
            <Icon
              name="person"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <select
              value={selectedAthleteId || ""}
              onChange={(e) => onAthleteChange(e.target.value || null)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue transition-colors cursor-pointer"
            >
              <option value="">Tous les athlètes</option>
              {athletes.map((ath) => (
                <option key={ath.id} value={ath.id}>
                  {ath.first_name} {ath.last_name}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500 pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
