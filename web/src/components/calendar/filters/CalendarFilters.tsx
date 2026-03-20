import { Icon } from "@/components/ui/Icon";
import { SPORT_CONFIG } from "@/lib/constants";

interface CalendarFiltersProps {
  athletes: any[];
  selectedAthleteId: string | null;
  selectedSport: string | null;
  onAthleteChange: (id: string | null) => void;
  onSportChange: (sport: string | null) => void;
  onTodayClick: () => void;
}

export function CalendarFilters({
  athletes,
  selectedAthleteId,
  selectedSport,
  onAthleteChange,
  onSportChange,
  onTodayClick,
}: CalendarFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
      <div className="flex-1 flex items-center gap-4">
        <select
          value={selectedAthleteId || ""}
          onChange={(e) => onAthleteChange(e.target.value || null)}
          className="w-full sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Tous les athlètes</option>
          {athletes.map((ath) => (
            <option key={ath.id} value={ath.id}>
              {ath.first_name} {ath.last_name}
            </option>
          ))}
        </select>

        <select
          value={selectedSport || "Tous les sports"}
          onChange={(e) => onSportChange(e.target.value)}
          className="w-full sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="Tous les sports">Tous les sports</option>
          {SPORT_CONFIG.map(s => (
            <option key={s.key} value={s.dbKey}>{s.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={onTodayClick}
        className="bg-accent-orange hover:bg-accent-orange/90 text-white px-3 py-1.5 rounded-sm text-sm font-semibold transition-colors flex items-center gap-2"
      >
        <Icon name="today" className="text-lg" />
        Aujourd'hui
      </button>
    </div>
  );
}
