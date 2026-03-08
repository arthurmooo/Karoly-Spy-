import { getActivities, type ActivityFilters } from '@/services/activities'
import { getAthletes } from '@/services/athletes'
import ActivityTable from '@/components/activity-table'
import ActivityFilterBar from '@/components/activity-filters'
import Pagination from '@/components/pagination'

export const dynamic = 'force-dynamic'

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    athlete?: string
    sport?: string
    from?: string
    to?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const filters: ActivityFilters = {
    athleteId: params.athlete || undefined,
    sport: params.sport || undefined,
    dateFrom: params.from || undefined,
    dateTo: params.to || undefined,
  }

  const [{ data, count, pageSize }, athletes] = await Promise.all([
    getActivities(page, filters),
    getAthletes(),
  ])

  const filterParams: Record<string, string> = {}
  if (params.athlete) filterParams.athlete = params.athlete
  if (params.sport) filterParams.sport = params.sport
  if (params.from) filterParams.from = params.from
  if (params.to) filterParams.to = params.to

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
        Activites
      </h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        {count} activite{count !== 1 ? 's' : ''}
      </p>
      <ActivityFilterBar athletes={athletes} />
      <ActivityTable activities={data} />
      <Pagination
        currentPage={page}
        totalCount={count}
        pageSize={pageSize}
        filterParams={filterParams}
      />
    </>
  )
}
