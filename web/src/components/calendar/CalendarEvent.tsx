import React from "react";
import { CalendarEvent as CalendarEventType } from "@/types/calendar";
import { Icon } from "@/components/ui/Icon";
import { useNavigate } from "react-router-dom";

interface CalendarEventProps {
  event: CalendarEventType;
  view: "week" | "month" | "year";
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({ event, view }) => {
  const navigate = useNavigate();

  const getSportConfig = (sport: string) => {
    switch (sport) {
      case "Course à pied":
      case "Run":
        return { icon: "directions_run", color: "text-accent-orange", bg: "bg-accent-orange/10", border: "border-accent-orange" };
      case "Vélo":
      case "Bike":
        return { icon: "directions_bike", color: "text-accent-blue", bg: "bg-accent-blue/10", border: "border-accent-blue" };
      case "Natation":
      case "Swim":
        return { icon: "pool", color: "text-teal-600", bg: "bg-teal-500/10", border: "border-teal-500" };
      case "Ski":
        return { icon: "downhill_skiing", color: "text-violet-600", bg: "bg-violet-500/10", border: "border-violet-500" };
      case "Musculation":
      case "Strength":
        return { icon: "fitness_center", color: "text-slate-600", bg: "bg-slate-200", border: "border-slate-400" };
      default:
        return { icon: "exercise", color: "text-slate-600", bg: "bg-slate-200", border: "border-slate-400" };
    }
  };

  const config = getSportConfig(event.sport);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.type === "realized" && event.activityId) {
      navigate(`/activities/${event.activityId}`);
    }
  };

  if (view === "month") {
    return (
      <div
        onClick={handleClick}
        className={`flex items-center gap-1 px-1.5 py-1 mb-1 rounded-r-sm border-l-2 ${
          event.type === "planned"
            ? "border-dashed bg-slate-100/50 dark:bg-slate-800/30 border-slate-400 opacity-70 cursor-default"
            : `${config.bg} ${config.color} ${config.border} cursor-pointer hover:opacity-80`
        } transition-opacity`}
        title={`${event.sport} - ${event.name}`}
      >
        <Icon name={config.icon} className={`text-[10px] shrink-0 ${event.type === "planned" ? "opacity-40" : ""}`} />
        <span className={`text-[10px] font-medium truncate ${event.type === "planned" ? "text-slate-400 italic" : ""}`}>
          {event.name}
        </span>
      </div>
    );
  }

  if (view === "week") {
    return (
      <div
        onClick={handleClick}
        className={`bg-white dark:bg-slate-900 rounded-sm border shadow-sm p-3 mb-2 border-l-4 ${
          event.type === "planned"
            ? "border-dashed border-slate-400 opacity-70 cursor-default"
            : `${config.border} cursor-pointer hover:border-slate-300 dark:hover:border-slate-700`
        } transition-colors`}
      >
        <div className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 mb-1 ${config.color}`}>
          <Icon name={config.icon} className="text-xs" />
          {event.sport}
        </div>
        <div className={`text-sm font-semibold truncate mb-1 ${event.type === "planned" ? "text-slate-400 italic" : "text-slate-900 dark:text-white"}`}>
          {event.name}
        </div>
        {event.durationSec && (
          <div className="text-xs text-slate-500 font-mono">
            {Math.floor(event.durationSec / 3600)}h {Math.floor((event.durationSec % 3600) / 60)}m
          </div>
        )}
        {event.distanceM && (
          <div className="text-xs text-slate-500 font-mono">
            {(event.distanceM / 1000).toFixed(1)} km
          </div>
        )}
        {event.mls && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">MLS:</span>
            <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">{event.mls.toFixed(1)}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
