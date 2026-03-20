export interface AthleteGroup {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  nolio_id: string | null;
  email: string | null;
  is_active: boolean;
  start_date: string | null;
  athlete_group_id: string | null;
}
