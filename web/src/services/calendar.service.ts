import { CalendarEvent } from "@/types/calendar";
import { isSameDay } from "date-fns";

export function mergeRealizedAndPlanned(activities: any[], plannedWorkouts: any[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Add realized activities
  activities?.forEach((act) => {
    events.push({
      id: act.id,
      date: new Date(act.session_date),
      type: "realized",
      sport: act.sport_type,
      name: act.activity_name,
      workType: act.work_type,
      durationSec: act.duration_sec,
      distanceM: act.distance_m,
      mls: act.load_index,
      avgHr: act.avg_hr,
      athleteId: act.athlete_id,
      athleteName: act.athletes ? `${act.athletes.first_name} ${act.athletes.last_name.charAt(0)}.` : "Inconnu",
      activityId: act.id,
    });
  });

  // Add planned workouts that are NOT linked to a realized activity
  plannedWorkouts?.forEach((pw) => {
    if (!pw.linked_activity_id) {
      events.push({
        id: pw.id,
        date: new Date(pw.planned_date),
        type: "planned",
        sport: pw.sport,
        name: pw.name,
        durationSec: pw.duration_planned_sec,
        distanceM: pw.distance_planned_m,
        athleteId: pw.athlete_id,
        athleteName: pw.athletes ? `${pw.athletes.first_name} ${pw.athletes.last_name.charAt(0)}.` : "Inconnu",
      });
    }
  });

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function groupByDay(events: CalendarEvent[], days: Date[]) {
  return days.map((day) => {
    return {
      date: day,
      events: events.filter((e) => isSameDay(e.date, day)),
    };
  });
}

export function calculateStats(events: CalendarEvent[]) {
  const realizedEvents = events.filter((e) => e.type === "realized");
  const totalSessions = realizedEvents.length;
  const totalDurationSec = realizedEvents.reduce((acc, e) => acc + (e.durationSec || 0), 0);
  const totalDistanceM = realizedEvents.reduce((acc, e) => acc + (e.distanceM || 0), 0);
  const avgMls = totalSessions > 0 ? realizedEvents.reduce((acc, e) => acc + (e.mls || 0), 0) / totalSessions : 0;

  return {
    totalSessions,
    totalDurationSec,
    totalDistanceM,
    avgMls: Number(avgMls.toFixed(1)),
  };
}
