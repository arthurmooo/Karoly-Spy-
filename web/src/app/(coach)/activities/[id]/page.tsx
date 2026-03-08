import { notFound } from 'next/navigation'
import { getActivityById } from '@/services/activities'
import { formatDuration, formatDistance, speedToPace } from '@/lib/utils'
import ActivityDetailClient from './client'
import Link from 'next/link'
import { MetricCard } from '@/components/ui/metric-card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'

export const dynamic = 'force-dynamic'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

const SPORT_LABELS: Record<string, string> = {
  run: 'Course',
  bike: 'Velo',
  swim: 'Natation',
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let activity
  try {
    activity = await getActivityById(id)
  } catch {
    notFound()
  }

  const athleteName = `${activity.athletes.first_name} ${activity.athletes.last_name}`
  const sportLabel = SPORT_LABELS[activity.sport_type] ?? activity.sport_type

  const paceMean = activity.manual_interval_pace_mean ?? activity.interval_pace_mean
  const paceLast = activity.manual_interval_pace_last ?? activity.interval_pace_last
  const hasManual =
    activity.manual_interval_pace_mean != null ||
    activity.manual_interval_pace_last != null ||
    activity.manual_interval_power_mean != null ||
    activity.manual_interval_power_last != null

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/activities"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <Icon name="arrow_back" size={16} />
          Activites
        </Link>

        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {athleteName}
          </h1>
          <span className="text-[var(--muted-foreground)]">&middot;</span>
          <span className="text-lg text-[var(--muted-foreground)]">
            {formatDate(activity.session_date)}
          </span>
          <span className="text-[var(--muted-foreground)]">&middot;</span>
          <span className="text-lg text-[var(--muted-foreground)]">
            {sportLabel}
          </span>
        </div>

        {/* Meta badges */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {activity.work_type && (
            <Badge>{activity.work_type}</Badge>
          )}
          {activity.activity_name && (
            <span className="max-w-xs truncate text-[var(--muted-foreground)]">
              {activity.activity_name}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap gap-4">
          <MetricCard label="Duree" value={formatDuration(activity.duration_sec) ?? '--'} />
          <MetricCard label="Distance" value={formatDistance(activity.distance_m) ?? '--'} />
          <MetricCard
            label="MLS"
            value={activity.load_index != null ? activity.load_index.toFixed(1) : '--'}
          />
          <MetricCard
            label="FC moy"
            value={activity.avg_hr != null ? `${Math.round(activity.avg_hr)} bpm` : '--'}
          />
          {activity.sport_type === 'bike' ? (
            <MetricCard
              label="Puiss. moy"
              value={activity.avg_power != null ? `${Math.round(activity.avg_power)} W` : '--'}
            />
          ) : (
            <MetricCard
              label="Allure"
              value={
                <span className={hasManual ? 'text-[var(--accent)]' : ''}>
                  {paceMean
                    ? `${speedToPace(paceMean)}${paceLast ? ` / ${speedToPace(paceLast)}` : ''}`
                    : '--'}
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* Client section: chart + manual detector */}
      <ActivityDetailClient
        activityId={activity.id}
        sportType={activity.sport_type}
        hasFitFile={!!activity.fit_file_path}
      />
    </>
  )
}
