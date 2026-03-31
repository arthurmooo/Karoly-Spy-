import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  isSameMonth,
  isToday,
} from "date-fns";
import { getActivities, getPlannedWorkouts, getAthletes } from "@/repositories/calendar.repository";
import { mergeRealizedAndPlanned, calculateStats } from "@/services/calendar.service";
import { CalendarEvent } from "@/types/calendar";

export function useCalendar(options?: { skipAthleteList?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get("view") as "week" | "month" | "year") || "month";
  const dateParam = searchParams.get("date");
  const currentDate = useMemo(() => dateParam ? new Date(dateParam) : new Date(), [dateParam]);
  const selectedAthleteId = searchParams.get("athlete") || null;
  const selectedSport = searchParams.get("sport") || "Tous les sports";
  const displayMode = (searchParams.get("display") as "all" | "planned" | "realized") || "all";

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plannedAvailable, setPlannedAvailable] = useState(true);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  };

  const setView = (newView: "week" | "month" | "year") => updateParams({ view: newView });
  const setAthlete = (id: string | null) => updateParams({ athlete: id });
  const setSport = (sport: string | null) => updateParams({ sport });
  const setDisplayMode = (mode: string) => updateParams({ display: mode === "all" ? null : mode });

  const goToToday = () => updateParams({ date: format(new Date(), "yyyy-MM-dd") });

  const navigateDate = (direction: "prev" | "next") => {
    let newDate = currentDate;
    if (view === "week") {
      newDate = direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1);
    } else if (view === "month") {
      newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    } else {
      newDate = direction === "prev" ? subYears(currentDate, 1) : addYears(currentDate, 1);
    }
    updateParams({ date: format(newDate, "yyyy-MM-dd") });
  };

  const dateRange = useMemo(() => {
    let start, end;
    if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (view === "month") {
      start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
    }
    return { start, end };
  }, [view, currentDate]);

  const filteredEvents = useMemo(() => {
    if (displayMode === "all") return events;
    return events.filter(e => e.type === displayMode);
  }, [events, displayMode]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(e => {
      const key = format(e.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [filteredEvents]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map((date) => ({
      date,
      isCurrentMonth: isSameMonth(date, currentDate),
      isToday: isToday(date),
      events: eventsByDate.get(format(date, "yyyy-MM-dd")) || [],
    }));
  }, [dateRange, currentDate, eventsByDate, view]);

  useEffect(() => {
    if (authLoading) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [acts, planned, aths] = await Promise.all([
          getActivities(dateRange.start.toISOString(), dateRange.end.toISOString(), selectedAthleteId, selectedSport),
          getPlannedWorkouts(dateRange.start.toISOString(), dateRange.end.toISOString(), selectedAthleteId, selectedSport),
          options?.skipAthleteList ? Promise.resolve([]) : getAthletes(),
        ]);
        setEvents(mergeRealizedAndPlanned(acts || [], planned.data || []));
        setPlannedAvailable(planned.isAvailable);
        setAthletes(aths || []);
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [authLoading, user?.id, dateRange, selectedAthleteId, selectedSport, options?.skipAthleteList]);

  const stats = useMemo(() => calculateStats(filteredEvents), [filteredEvents]);

  return {
    view,
    currentDate,
    selectedAthleteId,
    selectedSport,
    displayMode,
    events: filteredEvents,
    days,
    stats,
    athletes,
    isLoading,
    plannedAvailable,
    setView,
    setAthlete,
    setSport,
    setDisplayMode,
    navigateDate,
    goToToday,
  };
}
