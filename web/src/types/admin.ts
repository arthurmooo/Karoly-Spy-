export interface StructureCoach {
  id: string;
  display_name: string;
  email: string | null;
  role: "admin" | "coach";
  is_active: boolean;
  athlete_count: number;
  created_at: string | null;
}

export interface StructureAthleteAssignment {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
  start_date: string | null;
  coach_id: string | null;
}
