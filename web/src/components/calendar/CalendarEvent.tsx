import React from "react";
import { CalendarEvent as CalendarEventType } from "@/types/calendar";
import { Icon } from "@/components/ui/Icon";
import { getSportConfig } from "@/lib/constants";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isCoach as checkIsCoach } from "@/lib/auth/roles";

interface CalendarEventProps {
  event: CalendarEventType;
  view: "week" | "month" | "year";
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({ event, view }) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const config = getSportConfig(event.sport);
  const detailPath =
    event.activityId == null
      ? null
      : checkIsCoach(role)
        ? `/activities/${event.activityId}`
        : `/mon-espace/activities/${event.activityId}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.type === "realized" && detailPath) {
      navigate(detailPath);
    }
  };

  if (view === "month") {
    return (
      <div
        onClick={handleClick}
        data-testid={event.activityId ? `calendar-event-${event.activityId}` : undefined}
        className={`flex items-center gap-1 px-1.5 py-1 mb-1 rounded-r-lg border-l-2 ${
          event.type === "planned"
            ? "border-dashed bg-slate-100/50 dark:bg-slate-800/30 border-slate-400 opacity-70 cursor-default"
            : `${config.bgLight} ${config.textColor} ${config.border} cursor-pointer hover:opacity-80`
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
        data-testid={event.activityId ? `calendar-event-${event.activityId}` : undefined}
        className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-3 mb-2 border-l-4 ${
          event.type === "planned"
            ? "border-dashed border-slate-400 opacity-70 cursor-default"
            : `${config.border} cursor-pointer hover:border-slate-300 dark:hover:border-slate-700`
        } transition-all duration-150`}
      >
        <div className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 mb-1 ${config.textColor}`}>
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
