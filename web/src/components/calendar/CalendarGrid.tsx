import { useMemo } from "react";
import { CalendarDay } from "@/types/calendar";
import { CalendarCell } from "./CalendarCell";
import { getSportConfig } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarGridProps {
  view: "week" | "month" | "year";
  days: CalendarDay[];
  onDayClick?: (date: Date) => void;
}

export function CalendarGrid({ view, days, onDayClick }: CalendarGridProps) {
  const daysMap = useMemo(() => new Map(days.map(d => [format(d.date, "yyyy-MM-dd"), d])), [days]);
  if (view === "month") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
            <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(112px, auto)" }}>
          {days.map((day, i) => (
            <CalendarCell key={i} day={day} view="month" />
          ))}
        </div>
      </div>
    );
  }

  if (view === "week") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          {days.map((day, i) => (
            <div
              key={i}
              className={`py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                day.isToday ? "bg-accent-orange/10" : ""
              }`}
            >
              <div className={`text-[10px] font-bold uppercase tracking-wider ${day.isToday ? "text-accent-orange" : "text-slate-500"}`}>
                {format(day.date, "E", { locale: fr })}
              </div>
              <div className={`text-lg font-semibold ${day.isToday ? "text-accent-orange" : "text-slate-900 dark:text-white"}`}>
                {format(day.date, "d")}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">
          {days.map((day, i) => (
            <CalendarCell key={i} day={day} view="week" />
          ))}
        </div>
      </div>
    );
  }

  if (view === "year") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Array.from({ length: 12 }).map((_, monthIndex) => {
            const monthDate = new Date(days[0]?.date.getFullYear() || new Date().getFullYear(), monthIndex, 1);
            const daysInMonth = new Date(monthDate.getFullYear(), monthIndex + 1, 0).getDate();
            const firstDayOfWeek = monthDate.getDay() === 0 ? 6 : monthDate.getDay() - 1; // 0 = Monday

            return (
              <div key={monthIndex} className="space-y-2">
                <h3 className="text-sm font-bold text-primary capitalize">
                  {format(monthDate, "MMMM yyyy", { locale: fr })}
                </h3>
                <div className="grid grid-cols-7 gap-1">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} className="text-[9px] text-slate-400 text-center font-medium">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-3 h-3" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const date = new Date(monthDate.getFullYear(), monthIndex, i + 1);
                    const dayData = daysMap.get(format(date, "yyyy-MM-dd"));
                    const events = dayData?.events || [];

                    let bgColor = "bg-slate-100 dark:bg-slate-800";
                    let dotOpacity = "";
                    if (events.length > 0) {
                      const dominantSport = events.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0))[0]?.sport ?? "";
                      bgColor = getSportConfig(dominantSport).bgColor;
                      if (events.length === 1) dotOpacity = "opacity-40";
                    }

                    return (
                      <div
                        key={i}
                        onClick={() => onDayClick && onDayClick(date)}
                        className={`w-3 h-3 rounded-lg ${bgColor} ${dotOpacity} hover:opacity-80 cursor-pointer transition-all duration-150`}
                        title={`${format(date, "d MMMM", { locale: fr })} — ${events.length} séance(s)`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
