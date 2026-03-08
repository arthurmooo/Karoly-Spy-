import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Link } from 'react-router-dom'
import { formatDuration } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────── */

interface Athlete {
  id: string
  first_name: string
  last_name: string
}

interface WeeklyMLS {
  athlete: string
  week_start: string
  mls_hebdo: number | null
}

interface RecentActivity {
  id: string
  athlete_name: string
  sport_type: string
  duration_sec: number | null
  load_index: number | null
  session_date: string
}

interface FleetAlert {
  athlete_id: string
  athlete_name: string
  type: 'inactive'
  message: string
  badge: string
  badgeColor: string
}

/* ─── Helpers ────────────────────────────────────────── */

const SPORT_ICON: Record<string, string> = {
  run: 'directions_run',
  bike: 'pedal_bike',
  swim: 'pool',
}

const HEATMAP_COLORS = [
  'bg-slate-100 dark:bg-slate-700',        // 0 - repos
  'bg-blue-200 dark:bg-blue-900/60',        // 1
  'bg-blue-400 dark:bg-blue-700',           // 2
  'bg-orange-400 dark:bg-orange-600',       // 3
  'bg-orange-600 dark:bg-orange-500',       // 4 - critique
]

function mlsToLevel(mls: number | null): number {
  if (mls == null || mls <= 0) return 0
  if (mls < 200) return 1
  if (mls < 400) return 2
  if (mls < 600) return 3
  return 4
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/* ─── Component ──────────────────────────────────────── */

export default function DashboardPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyMLS[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [alerts, setAlerts] = useState<FleetAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 10)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

      const [athletesRes, weeklyRes, activitiesRes, allAthletesRes, recentActsRes] = await Promise.all([
        supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true),
        supabase.from('view_weekly_monitoring').select('*').order('week_start', { ascending: false }).limit(500),
        supabase.from('activities')
          .select('id, session_date, sport_type, duration_sec, load_index, athletes!inner(first_name, last_name)')
          .gte('session_date', since48h)
          .order('session_date', { ascending: false })
          .limit(10),
        supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true),
        supabase.from('activities').select('athlete_id').gte('session_date', sevenDaysAgo),
      ])

      setAthletes(athletesRes.data ?? [])
      setWeeklyData((weeklyRes.data ?? []) as WeeklyMLS[])

      const acts = (activitiesRes.data ?? []).map((a: any) => ({
        id: a.id,
        athlete_name: `${a.athletes.first_name} ${a.athletes.last_name}`,
        sport_type: a.sport_type,
        duration_sec: a.duration_sec,
        load_index: a.load_index,
        session_date: a.session_date,
      }))
      setRecentActivities(acts)

      const activeIds = new Set((recentActsRes.data ?? []).map((a: any) => a.athlete_id))
      const alertList: FleetAlert[] = []
      for (const athlete of (allAthletesRes.data ?? [])) {
        if (!activeIds.has(athlete.id)) {
          alertList.push({
            athlete_id: athlete.id,
            athlete_name: `${athlete.first_name} ${athlete.last_name}`,
            type: 'inactive',
            message: 'Aucune activité depuis +7 jours',
            badge: 'RECUP',
            badgeColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
          })
        }
      }
      setAlerts(alertList)
      setLoading(false)
    }
    load()
  }, [])

  /* ─── Heatmap data: last 12 weeks per athlete ─── */
  const { heatmapRows, weeks, currentWeek } = useMemo(() => {
    const now = new Date()
    const currentWeek = getWeekNumber(now)
    const weeksList: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 3600 * 1000)
      const monday = new Date(d)
      monday.setDate(d.getDate() - (d.getDay() || 7) + 1)
      weeksList.push(monday.toISOString().slice(0, 10))
    }

    const rows = athletes.map((ath) => {
      const name = `${ath.first_name.charAt(0)}. ${ath.last_name}`
      const cells = weeksList.map((weekStart, idx) => {
        const entry = weeklyData.find(
          (w) => w.athlete === `${ath.first_name} ${ath.last_name}` && w.week_start === weekStart
        )
        const level = mlsToLevel(entry?.mls_hebdo ?? null)
        const isCurrentWeek = idx === weeksList.length - 1
        return { level, isCurrentWeek }
      })
      return { id: ath.id, name, cells }
    })

    return { heatmapRows: rows, weeks: weeksList, currentWeek }
  }, [athletes, weeklyData])

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const weekSessions = recentActivities.filter((a) => a.session_date >= weekAgo).length

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
        <Icon name="progress_activity" size={16} className="animate-spin" />
        Chargement...
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          label="Athlètes actifs"
          value={athletes.length}
          icon="groups"
          trend={null}
        />
        <KpiCard
          label="Séances cette semaine"
          value={weekSessions}
          icon="calendar_today"
          trend={null}
        />
        <KpiCard
          label="Alertes critiques"
          value={String(alerts.length).padStart(2, '0')}
          icon="error"
          isAlert={alerts.length > 0}
          badgeText={alerts.length > 0 ? 'URGENT' : undefined}
        />
      </div>

      {/* ─── Charge MLS Heatmap ─── */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-xl text-[var(--foreground)]">Analyse de la Charge MLS (12 dernières semaines)</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Vue d'ensemble de la charge d'entraînement par athlète</p>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 transition-colors border border-[var(--border)]">
            <Icon name="open_in_full" size={20} />
          </button>
        </div>

        {heatmapRows.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4">Aucune donnée de charge disponible.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px] space-y-5">
              {heatmapRows.map((row) => (
                <div key={row.id} className="flex items-center gap-6">
                  <div className="w-36 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      {row.name.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate">{row.name}</span>
                  </div>
                  <div className="flex gap-2 flex-1 justify-between">
                    {row.cells.map((cell, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded ${HEATMAP_COLORS[cell.level]} ${
                          cell.isCurrentWeek ? 'ring-2 ring-[var(--primary)] ring-offset-2 dark:ring-offset-[var(--card)]' : ''
                        } transition-colors`}
                        title={`S${getWeekNumber(new Date(weeks[i]))}: MLS niveau ${cell.level}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-10 pt-6 border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Légende de Charge</p>
            <div className="flex items-center gap-2">
              {HEATMAP_COLORS.map((color, i) => (
                <div key={i} className={`w-4 h-4 rounded ${color}`} />
              ))}
              <span className="text-[11px] font-medium text-[var(--muted-foreground)] ml-2">
                Faible (Repos) → Critique (Surcompensation)
              </span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest italic">
            Semaine actuelle: S{currentWeek}
          </p>
        </div>
      </section>

      {/* ─── Bottom Grid: Alerts + Recent Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alerts */}
        <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--foreground)]">Alertes d'attention</h3>
            <button className="text-xs text-blue-600 font-semibold hover:underline">Tout voir</button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {alerts.length === 0 ? (
              <div className="p-6 flex items-center gap-3">
                <Icon name="check_circle" size={20} className="text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Aucune alerte — tout est OK</span>
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div key={alert.athlete_id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                    {alert.athlete_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{alert.athlete_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{alert.message}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold rounded ${alert.badgeColor}`}>
                    {alert.badge}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--foreground)]">Activité récente</h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer">TOUT</span>
              <span className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-[10px] font-bold rounded cursor-pointer">NAT</span>
              <span className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-[10px] font-bold rounded cursor-pointer">VELO</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {recentActivities.length === 0 ? (
              <p className="py-4 text-sm text-[var(--muted-foreground)]">Aucune activité récente.</p>
            ) : (
              recentActivities.slice(0, 8).map((a) => (
                <Link
                  key={a.id}
                  to={`/activities/${a.id}`}
                  className="flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      name={SPORT_ICON[a.sport_type] ?? 'sports'}
                      size={16}
                      className={a.sport_type === 'bike' ? 'text-[var(--accent)]' : 'text-blue-600'}
                    />
                    <span className="font-medium text-[var(--foreground)]">{a.athlete_name}</span>
                  </div>
                  <span className="text-[var(--muted-foreground)]">
                    {a.duration_sec ? formatDuration(a.duration_sec) : '—'}
                  </span>
                  {a.load_index != null && (
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-[10px] ${
                      a.load_index > 150
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : a.load_index > 80
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {Math.round(a.load_index)}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ─── KPI Card sub-component ─── */

function KpiCard({
  label,
  value,
  icon,
  trend,
  isAlert,
  badgeText,
}: {
  label: string
  value: string | number
  icon: string
  trend?: string | null
  isAlert?: boolean
  badgeText?: string
}) {
  return (
    <div
      className={`bg-[var(--card)] p-6 rounded-xl border shadow-[var(--shadow-card)] ${
        isAlert
          ? 'border-[var(--accent)]/20 bg-gradient-to-br from-[var(--card)] to-orange-50/30 dark:to-orange-950/10'
          : 'border-[var(--border)]'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[var(--muted-foreground)] text-sm font-medium">{label}</span>
        <span
          className={`p-2 rounded-lg ${
            isAlert
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
          }`}
        >
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${isAlert ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
          {value}
        </span>
        {badgeText && (
          <span className="px-2 py-1 bg-[var(--accent)] text-white text-[10px] font-bold rounded uppercase tracking-wider mb-2">
            {badgeText}
          </span>
        )}
        {trend && (
          <span className="text-emerald-500 text-sm font-medium mb-1.5 flex items-center">
            <Icon name="trending_up" size={14} /> {trend}
          </span>
        )}
      </div>
    </div>
  )
}
