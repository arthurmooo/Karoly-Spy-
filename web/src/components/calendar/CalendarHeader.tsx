import { Icon } from "@/components/ui/Icon";

import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarHeaderProps {
  view: "week" | "month" | "year";
  currentDate: Date;
  onViewChange: (view: "week" | "month" | "year") => void;
  onNavigate: (direction: "prev" | "next") => void;
}

export function CalendarHeader({ view, currentDate, onViewChange, onNavigate }: CalendarHeaderProps) {
  const getTitle = () => {
    if (view === "week") {
      return `Semaine du ${format(currentDate, "d MMMM yyyy", { locale: fr })}`;
    } else if (view === "month") {
      return format(currentDate, "MMMM yyyy", { locale: fr });
    } else {
      return format(currentDate, "yyyy", { locale: fr });
    }
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-extrabold text-primary flex items-center gap-3">
          <Icon name="calendar_month" className="text-3xl" />
          Calendrier d'Entraînement
        </h1>
        <p className="text-sm text-slate-500 mt-1">Planification et suivi des séances</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          <button
            onClick={() => onNavigate("prev")}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-150"
          >
            <Icon name="chevron_left" />
          </button>
          
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onViewChange("week")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                view === "week" ? "bg-primary text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => onViewChange("month")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                view === "month" ? "bg-primary text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => onViewChange("year")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                view === "year" ? "bg-primary text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Année
            </button>
          </div>

          <button
            onClick={() => onNavigate("next")}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-150"
          >
            <Icon name="chevron_right" />
          </button>
        </div>
        
        <div className="text-lg font-semibold text-slate-900 dark:text-white min-w-[150px] text-right capitalize">
          {getTitle()}
        </div>
      </div>
    </div>
  );
}
