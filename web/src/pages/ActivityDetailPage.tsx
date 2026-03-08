import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDuration, formatDistance, speedToPace } from '@/lib/utils'
import { MetricCard } from '@/components/ui/metric-card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { Card } from '@/components/ui/card'

const SPORT_LABELS: Record<string, string> = { run: 'Course', bike: 'Velo', swim: 'Natation' }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('activities')
        .select(`id, session_date, sport_type, work_type, activity_name, duration_sec, distance_m, load_index, avg_hr, avg_power,
          interval_pace_mean, interval_pace_last, manual_interval_pace_mean, manual_interval_pace_last,
          manual_interval_power_mean, manual_interval_power_last, fit_file_path, athlete_id,
          athletes!inner(first_name, last_name)`)
        .eq('id', id!)
        .single()

      if (error) { setError('Activité introuvable'); setLoading(false); return }
      setActivity(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]"><Icon name="progress_activity" size={16} className="animate-spin" />Chargement...</div>
  if (error || !activity) return <div className="py-12 text-center text-sm text-red-600">{error ?? 'Erreur'}</div>

  const athleteName = `${activity.athletes.first_name} ${activity.athletes.last_name}`
  const sportLabel = SPORT_LABELS[activity.sport_type] ?? activity.sport_type
  const paceMean = activity.manual_interval_pace_mean ?? activity.interval_pace_mean
  const paceLast = activity.manual_interval_pace_last ?? activity.interval_pace_last
  const hasManual = activity.manual_interval_pace_mean != null || activity.manual_interval_pace_last != null || activity.manual_interval_power_mean != null || activity.manual_interval_power_last != null

  return (
    <>
      <div className="mb-6">
        <Link to="/activities" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <Icon name="arrow_back" size={16} />Activites
        </Link>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{athleteName}</h1>
          <span className="text-[var(--muted-foreground)]">·</span>
          <span className="text-lg text-[var(--muted-foreground)]">{formatDate(activity.session_date)}</span>
          <span className="text-[var(--muted-foreground)]">·</span>
          <span className="text-lg text-[var(--muted-foreground)]">{sportLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {activity.work_type && <Badge>{activity.work_type}</Badge>}
          {activity.activity_name && <span className="max-w-xs truncate text-[var(--muted-foreground)]">{activity.activity_name}</span>}
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <MetricCard label="Duree" value={formatDuration(activity.duration_sec) ?? '--'} />
          <MetricCard label="Distance" value={formatDistance(activity.distance_m) ?? '--'} />
          <MetricCard label="MLS" value={activity.load_index != null ? activity.load_index.toFixed(1) : '--'} />
          <MetricCard label="FC moy" value={activity.avg_hr != null ? `${Math.round(activity.avg_hr)} bpm` : '--'} />
          {activity.sport_type === 'bike' ? (
            <MetricCard label="Puiss. moy" value={activity.avg_power != null ? `${Math.round(activity.avg_power)} W` : '--'} />
          ) : (
            <MetricCard label="Allure" value={
              <span className={hasManual ? 'text-[var(--accent)]' : ''}>
                {paceMean ? `${speedToPace(paceMean)}${paceLast ? ` / ${speedToPace(paceLast)}` : ''}` : '--'}
              </span>
            } />
          )}
        </div>
      </div>
      <Card className="text-sm text-[var(--muted-foreground)]">
        Graphique FIT et detection manuelle disponibles apres integration complete.
      </Card>
    </>
  )
}
