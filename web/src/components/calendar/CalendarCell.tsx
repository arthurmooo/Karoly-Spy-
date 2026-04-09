import React, { useState } from "react";
import { CalendarDay } from "@/types/calendar";
import { CalendarEvent } from "./CalendarEvent";
import { format } from "date-fns";


interface CalendarCellProps {
  day: CalendarDay;
  view: "week" | "month" | "year";
}

export const CalendarCell: React.FC<CalendarCellProps> = ({ day, view }) => {
  const [showAll, setShowAll] = useState(false);

  if (view === "month") {
    const visibleEvents = showAll ? day.events : day.events.slice(0, 3);
    const hiddenCount = day.events.length - 3;

    return (
      <div
        className={`min-h-[112px] p-1 border-b border-r border-slate-200 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
          !day.isCurrentMonth ? "opacity-30 bg-slate-50 dark:bg-slate-900" : "bg-white dark:bg-slate-900"
        }`}
      >
        <div className="flex justify-end mb-1">
          <span
            className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
              day.isToday ? "bg-accent-orange text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {format(day.date, "d")}
          </span>
        </div>
        <div className="space-y-1">
          {visibleEvents.map((event) => (
            <CalendarEvent key={event.id} event={event} view="month" />
          ))}
          {hiddenCount > 0 && !showAll && (
            <div
              onClick={() => setShowAll(true)}
              className="text-[10px] text-primary cursor-pointer hover:underline font-medium px-1"
            >
              +{hiddenCount} autres
            </div>
          )}
          {showAll && (
            <div
              onClick={() => setShowAll(false)}
              className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer hover:underline font-medium px-1"
            >
              Réduire
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "week") {
    return (
      <div className="min-h-[300px] p-1.5 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="space-y-1">
          {day.events.map((event) => (
            <CalendarEvent key={event.id} event={event} view="week" />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
