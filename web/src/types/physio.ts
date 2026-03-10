export interface PhysioProfile {
  id: string;
  athlete_id: string;
  sport: string;
  lt1_hr: number | null;
  lt2_hr: number | null;
  lt1_power_pace: number | null;
  lt2_power_pace: number | null;
  cp_cs: number | null;
  weight: number | null;
  vma: number | null;
  cp_montee: number | null;
  cp_ht: number | null;
  valid_from: string;
  valid_to: string | null;
}
