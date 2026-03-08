import {
  getProfiles as getProfilesFromDb,
  insertProfile as insertProfileFromDb,
  type InsertProfilePayload,
} from '@/repositories/physio'
import type { PhysioProfile } from '@/types'

export async function getProfiles(athleteId: string): Promise<PhysioProfile[]> {
  return getProfilesFromDb(athleteId)
}

export async function insertProfile(payload: InsertProfilePayload) {
  return insertProfileFromDb(payload)
}

export type { InsertProfilePayload }
