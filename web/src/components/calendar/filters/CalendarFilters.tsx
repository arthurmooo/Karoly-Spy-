import { Icon } from "@/components/ui/Icon";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
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
        <SearchableSelect
          value={selectedAthleteId || ""}
          onChange={(v) => onAthleteChange(v || null)}
          options={[
            { value: "", label: "Tous les athlètes" },
            ...athletes.map((ath) => ({ value: ath.id, label: `${ath.first_name} ${ath.last_name}` })),
          ]}
          placeholder="Tous les athlètes"
          className="w-full sm:w-64"
          icon="person"
        />

        <SearchableSelect
          value={selectedSport || "Tous les sports"}
          onChange={onSportChange}
          options={[
            { value: "Tous les sports", label: "Tous les sports" },
            ...SPORT_CONFIG.map((s) => ({ value: s.dbKey, label: s.label })),
          ]}
          placeholder="Tous les sports"
          className="w-full sm:w-64"
        />
      </div>

      <button
        onClick={onTodayClick}
        className="bg-accent-orange hover:bg-accent-orange/90 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2"
      >
        <Icon name="today" className="text-lg" />
        Aujourd'hui
      </button>
    </div>
  );
}
