import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDuration, formatDistance, speedToPace } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'

const PAGE_SIZE = 15

const SPORT_ICONS: Record<string, { icon: string; color: string }> = {
  run: { icon: 'directions_run', color: 'text-[var(--primary)]' },
  bike: { icon: 'directions_bike', color: 'text-blue-600' },
  swim: { icon: 'pool', color: 'text-teal-600' },
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  endurance: { bg: 'bg-[var(--primary)]/10', text: 'text-[var(--primary)]' },
  intervals: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  competition: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]' },
  recovery: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
  test: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatDurationHMS(sec: number | null): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatAllurePower(sport: string, avgPower: number | null, distM: number | null, durationSec: number | null): string {
  if (sport === 'bike' && avgPower != null) return `${Math.round(avgPower)} W`
  if (sport === 'swim' && distM && durationSec && distM > 0) {
    const per100 = (durationSec / (distM / 100))
    const min = Math.floor(per100 / 60)
    const sec = Math.round(per100 % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')} /100m`
  }
  if (sport === 'run' && distM && durationSec && distM > 0) {
    const perKm = durationSec / (distM / 1000)
    const min = Math.floor(perKm / 60)
    const sec = Math.round(perKm % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')} /km`
  }
  if (avgPower != null) return `${Math.round(avgPower)} W`
  return '—'
}

export default function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activities, setActivities] = useState<any[]>([])
  const [athletes, setAthletes] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const athleteFilter = searchParams.get('athlete') ?? ''
  const sportFilter = searchParams.get('sport') ?? ''
  const dateFilter = searchParams.get('date') ?? ''

  const updateFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      next.delete('page')
      return next
    })
  }, [setSearchParams])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase.from('activities').select(
        'id, session_date, sport_type, work_type, activity_name, duration_sec, distance_m, load_index, avg_hr, avg_power, rpe, athletes!inner(first_name, last_name)',
        { count: 'exact' }
      )

      if (athleteFilter) query = query.eq('athlete_id', athleteFilter)
      if (sportFilter) query = query.eq('sport_type', sportFilter)
      if (dateFilter) query = query.lte('session_date', dateFilter)

      const [activitiesRes, athletesRes] = await Promise.all([
        query.order('session_date', { ascending: false }).range(from, to),
        supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
      ])

      setActivities(activitiesRes.data ?? [])
      setCount(activitiesRes.count ?? 0)
      setAthletes(athletesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [page, athleteFilter, sportFilter, dateFilter])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  /* ─── Weekly stats ─── */
  const weekStats = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const weekActs = activities.filter(a => a.session_date >= weekAgo)
    const totalDist = weekActs.reduce((s, a) => s + (a.distance_m ?? 0), 0)
    const totalDur = weekActs.reduce((s, a) => s + (a.duration_sec ?? 0), 0)
    const avgMLS = weekActs.length > 0
      ? weekActs.reduce((s, a) => s + (a.load_index ?? 0), 0) / weekActs.length
      : 0
    return { totalDist, totalDur, avgMLS }
  }, [activities])

  const goToPage = (p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── Title ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Journal d'Activités</h2>
          <p className="text-[var(--muted-foreground)] mt-1">Gérez et analysez les performances de vos athlètes en temps réel.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[var(--foreground)]">
            <Icon name="download" size={18} />
            Exporter CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm">
            <Icon name="add" size={18} />
            Nouvelle Activité
          </button>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-wrap items-end gap-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">Athlète</label>
          <div className="relative">
            <select
              value={athleteFilter}
              onChange={(e) => updateFilter('athlete', e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer text-[var(--foreground)]"
            >
              <option value="">Tous les athlètes</option>
              {athletes.map((a: any) => (
                <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
              ))}
            </select>
            <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">Sport</label>
          <div className="relative">
            <select
              value={sportFilter}
              onChange={(e) => updateFilter('sport', e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer text-[var(--foreground)]"
            >
              <option value="">Choisir un sport...</option>
              <option value="run">Course</option>
              <option value="bike">Vélo</option>
              <option value="swim">Natation</option>
            </select>
            <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">Période</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => updateFilter('date', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-[var(--primary)] text-[var(--foreground)]"
          />
        </div>
        <div className="flex-1 flex justify-end">
          <div className="relative w-64">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--muted-foreground)] text-[var(--foreground)]"
              placeholder="Rechercher une séance..."
              type="text"
            />
          </div>
        </div>
      </div>

      {/* ─── Data Table ─── */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
          <Icon name="progress_activity" size={16} className="animate-spin" />Chargement...
        </div>
      ) : activities.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">Aucune activité trouvée.</p>
      ) : (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--primary)] text-white">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Athlète</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-center">Sport</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right">Durée</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right hidden md:table-cell">Distance</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right hidden md:table-cell">MLS</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right hidden lg:table-cell">FC Moy</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right hidden lg:table-cell">Allure/Pui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {activities.map((a: any) => {
                  const sport = SPORT_ICONS[a.sport_type] ?? { icon: 'sports', color: 'text-[var(--muted-foreground)]' }
                  const typeBadge = TYPE_BADGE[a.work_type] ?? TYPE_BADGE.endurance
                  return (
                    <tr
                      key={a.id}
                      className="transition-colors cursor-pointer hover:bg-[rgba(36,0,102,0.03)] dark:hover:bg-[rgba(167,139,250,0.04)]"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[var(--muted-foreground)] whitespace-nowrap">
                        <Link to={`/activities/${a.id}`}>{formatDateFr(a.session_date)}</Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/activities/${a.id}`} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                            {a.athletes.first_name[0]}
                          </div>
                          <span className="text-sm font-bold text-[var(--foreground)]">
                            {a.athletes.first_name} {a.athletes.last_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Icon name={sport.icon} size={22} className={sport.color} />
                      </td>
                      <td className="px-6 py-4">
                        {a.work_type ? (
                          <span className={`px-2.5 py-1 rounded-full ${typeBadge.bg} ${typeBadge.text} text-[10px] font-bold uppercase tracking-wide`}>
                            {a.work_type}
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-[var(--foreground)]">
                        {formatDurationHMS(a.duration_sec)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-[var(--foreground)] hidden md:table-cell">
                        {a.distance_m ? `${(a.distance_m / 1000).toFixed(2)} km` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-[var(--muted-foreground)] hidden md:table-cell">
                        {a.load_index != null ? a.load_index.toFixed(1) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-[var(--muted-foreground)] hidden lg:table-cell">
                        {a.avg_hr != null ? `${Math.round(a.avg_hr)} bpm` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-[var(--primary)] hidden lg:table-cell">
                        {formatAllurePower(a.sport_type, a.avg_power, a.distance_m, a.duration_sec)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Pagination ─── */}
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <p className="text-xs text-[var(--muted-foreground)]">
              Affichage de <span className="font-bold text-[var(--foreground)]">{activities.length}</span> sur{' '}
              <span className="font-bold text-[var(--foreground)]">{count}</span> activités
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="p-1 border border-[var(--border)] rounded-md text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors disabled:opacity-30"
              >
                <Icon name="chevron_left" size={20} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      p === page
                        ? 'bg-[var(--primary)] text-white'
                        : 'text-[var(--muted-foreground)] hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="p-1 border border-[var(--border)] rounded-md text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors disabled:opacity-30"
              >
                <Icon name="chevron_right" size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom Stats ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatBottom label="Distance Totale (Semaine)" value={`${(weekStats.totalDist / 1000).toFixed(1)} km`} />
        <StatBottom label="Charge MLS Moyenne" value={weekStats.avgMLS > 0 ? weekStats.avgMLS.toFixed(1) : '—'} sub="Stable" />
        <StatBottom
          label="Volume d'Entraînement"
          value={weekStats.totalDur > 0 ? `${Math.floor(weekStats.totalDur / 3600)}h ${Math.round((weekStats.totalDur % 3600) / 60)}m` : '—'}
        />
        <StatBottom label="Score de Récupération" value="—" />
      </div>
    </div>
  )
}

function StatBottom({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--card)] p-6 rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-[var(--foreground)]">{value}</h3>
        {sub && <span className="text-xs font-bold text-[var(--muted-foreground)]">{sub}</span>}
      </div>
    </div>
  )
}
