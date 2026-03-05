import type { Tables } from './database'

// ── Core domain types (mapped from database.ts) ──

export type Athlete = Tables<'athletes'>

export type Activity = Tables<'activities'>

export type ActivityInterval = Tables<'activity_intervals'>

export type PhysioProfile = Tables<'physio_profiles'>

export type DailyReadiness = Tables<'daily_readiness'>

// ── Sport types ──

export type SportType = 'run' | 'bike' | 'swim' | 'strength' | 'other'

export type WorkType = 'endurance' | 'intervals' | 'competition' | 'recovery' | 'test'

// ── View types ──

export type MonitoringRow = Tables<'view_athlete_monitoring_karo'>

export type LiveFluxRow = Tables<'view_live_flux'>

export type HealthRadarRow = Tables<'view_health_radar'>

// ── Auth types ──

export type UserRole = 'coach' | 'athlete'

export interface UserProfile {
  id: string
  role: UserRole
  display_name: string
  created_at: string
}
