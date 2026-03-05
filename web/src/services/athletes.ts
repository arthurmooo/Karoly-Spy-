import { getAthletes as getAthletesFromDb, getAthleteById as getAthleteByIdFromDb } from '@/repositories/athletes'
import type { Athlete } from '@/types'

export async function getAthletes(): Promise<Athlete[]> {
  return getAthletesFromDb()
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  return getAthleteByIdFromDb(id)
}
