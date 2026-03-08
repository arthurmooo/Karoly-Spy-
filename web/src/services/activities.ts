import {
  getActivities as getActivitiesFromDb,
  getActivityById as getActivityByIdFromDb,
  updateIntervalOverride as updateFromDb,
  type ActivityFilters,
  type IntervalOverridePayload,
} from '@/repositories/activities'

export async function getActivities(page: number = 1, filters: ActivityFilters = {}) {
  return getActivitiesFromDb(page, filters)
}

export async function getActivityById(id: string) {
  return getActivityByIdFromDb(id)
}

export async function updateIntervalOverride(
  activityId: string,
  payload: IntervalOverridePayload
) {
  return updateFromDb(activityId, payload)
}

export type { ActivityFilters, IntervalOverridePayload }
