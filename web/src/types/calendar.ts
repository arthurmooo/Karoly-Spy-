export interface CalendarEvent {
  id: string;
  date: Date;
  type: "realized" | "planned";
  sport: string;                // Run, Bike, Swim, Ski, Strength, Other
  name: string;                 // activity_name ou planned name
  workType?: string;            // endurance, intervals, competition
  durationSec?: number;
  distanceM?: number;
  mls?: number;
  avgHr?: number;
  athleteId: string;
  athleteName: string;
  activityId?: string;          // null si planifié non réalisé
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export interface CalendarState {
  view: "week" | "month" | "year";
  currentDate: Date;
  selectedAthleteId: string | null;
  selectedSport: string | null;
}

export interface CalendarData {
  activities: any[];
  plannedWorkouts: any[];
  stats: {
    totalSessions: number;
    totalDurationSec: number;
    totalDistanceM: number;
    avgMls: number;
  };
  isLoading: boolean;
}
