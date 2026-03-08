import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/ui/icon'
import { parseAndImportCsv, type ImportResult } from '@/lib/csv-import'

const PAGE_SIZE = 10

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export default function HealthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const athleteId = searchParams.get('athlete') ?? ''
  const [athletes, setAthletes] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [athletesRes, radarRes] = await Promise.all([
        supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
        supabase.from('view_health_radar').select('*').order('date', { ascending: false }),
      ])
      setAthletes(athletesRes.data ?? [])
      const allRows = radarRes.data ?? []
      setRows(athleteId ? allRows.filter((r: any) => r.athlete_id === athleteId) : allRows)
      setLoading(false)
    }
    load()
  }, [athleteId])

  const filteredRows = filter
    ? rows.filter((r: any) => r.athlete?.toLowerCase().includes(filter.toLowerCase()))
    : rows

  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE)

  const alertCount = rows.filter((r: any) => r.tendance_rmssd_pct != null && r.tendance_rmssd_pct < -10).length
  const rmssdRows = rows.filter((r: any) => r.rmssd_matinal != null)
  const avgReadiness = rmssdRows.length > 0
    ? Math.round((rmssdRows.reduce((a: number, r: any) => a + r.rmssd_matinal, 0) / rmssdRows.length))
    : null

  const lastSync = rows.length > 0 ? rows[0] : null

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) return
    setImportStatus('uploading')
    setImportResult(null)
    try {
      const text = await file.text()
      const result = await parseAndImportCsv(text)
      setImportResult(result)
      // Reload data if rows were imported
      if (result.imported > 0) {
        const { data } = await supabase.from('view_health_radar').select('*').order('date', { ascending: false })
        const allRows = data ?? []
        setRows(athleteId ? allRows.filter((r: any) => r.athlete_id === athleteId) : allRows)
      }
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: ['Erreur inattendue lors de l\'import'] })
    }
    setImportStatus('done')
  }, [athleteId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── HRV4Training Import Zone ─── */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-2">
            <Icon name="upload_file" size={18} />
            Import de données HRV4Training
          </h3>
          <span className="text-[11px] text-[var(--muted-foreground)] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            Format CSV requis
          </span>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors ${
            dragOver
              ? 'border-[var(--primary)] bg-[var(--primary)]/5'
              : 'border-[var(--border)] hover:border-[var(--primary)]'
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Icon name="cloud_upload" size={24} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">Glissez-déposez votre export HRV4Training ici</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">Ou cliquez pour parcourir vos fichiers</p>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--muted-foreground)] bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded border border-[var(--border)]">
            Format: email ; date ; heure ; FC repos ; rMSSD
          </div>
        </div>

        {/* Import feedback */}
        {importStatus === 'uploading' && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <Icon name="progress_activity" size={16} className="animate-spin" /> Import en cours...
          </div>
        )}
        {importStatus === 'done' && importResult && (
          <div className="mt-4 space-y-2">
            {importResult.imported > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                {importResult.imported} ligne{importResult.imported !== 1 ? 's' : ''} importée{importResult.imported !== 1 ? 's' : ''}
                {importResult.skipped > 0 && `, ${importResult.skipped} ignorée${importResult.skipped !== 1 ? 's' : ''}`}
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="mb-1 font-medium">Avertissements :</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.imported === 0 && importResult.errors.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                Aucune ligne importée.
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Data Table ─── */}
      <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="font-bold text-[var(--foreground)]">Dernières Mesures Biométriques</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(0) }}
                className="pl-9 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] dark:bg-slate-900 w-48 focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--foreground)]"
                placeholder="Filtrer..."
                type="text"
              />
            </div>
            <button className="p-1.5 rounded border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800">
              <Icon name="filter_list" size={16} className="text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-[var(--muted-foreground)]">
            <Icon name="progress_activity" size={16} className="animate-spin" />Chargement...
          </div>
        ) : pagedRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">Aucune donnée santé disponible.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[var(--muted-foreground)] font-medium">
                  <th className="px-6 py-4 border-b border-[var(--border)]">Athlète</th>
                  <th className="px-6 py-4 border-b border-[var(--border)]">Date</th>
                  <th className="px-6 py-4 border-b border-[var(--border)] text-center">rMSSD (ms)</th>
                  <th className="px-6 py-4 border-b border-[var(--border)] text-center">FC repos (bpm)</th>
                  <th className="px-6 py-4 border-b border-[var(--border)] text-center">Tendance rMSSD</th>
                  <th className="px-6 py-4 border-b border-[var(--border)] text-center">Poids (kg)</th>
                  <th className="px-6 py-4 border-b border-[var(--border)]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pagedRows.map((r: any, i: number) => (
                  <tr key={`${r.athlete_id}-${r.date}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[var(--foreground)]">{r.athlete ?? '—'}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{r.date ? formatDateFr(r.date) : '—'}</td>
                    <td className="px-6 py-4 text-center font-mono font-medium text-[var(--foreground)]">
                      {r.rmssd_matinal != null ? r.rmssd_matinal.toFixed(1) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">
                      {r.fc_repos != null ? `${Math.round(r.fc_repos)} bpm` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {r.tendance_rmssd_pct != null ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          r.tendance_rmssd_pct >= 0
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                        }`}>
                          <Icon name={r.tendance_rmssd_pct >= 0 ? 'trending_up' : 'trending_down'} size={14} />
                          {r.tendance_rmssd_pct >= 0 ? '+' : ''}{r.tendance_rmssd_pct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">
                      {r.poids != null ? `${r.poids} kg` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
                        <Icon name="more_horiz" size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)]">
            Affichage de {pagedRows.length} sur {filteredRows.length} mesures enregistrées
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-[var(--border)] text-xs font-medium bg-[var(--card)] disabled:opacity-50 text-[var(--foreground)]"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-[var(--border)] text-xs font-medium bg-[var(--card)] disabled:opacity-50 text-[var(--foreground)]"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {/* ─── Bottom Summary Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Alertes de Santé */}
        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <Icon name="health_and_safety" size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="font-bold text-sm text-[var(--foreground)]">Alertes de Santé</h4>
          </div>
          <p className={`text-2xl font-bold ${alertCount > 0 ? 'text-[var(--accent)]' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {alertCount}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {alertCount === 0
              ? 'Aucune anomalie détectée sur les dernières 48h.'
              : `${alertCount} anomalie${alertCount > 1 ? 's' : ''} détectée${alertCount > 1 ? 's' : ''}.`}
          </p>
        </div>

        {/* Readiness Cohorte */}
        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <Icon name="groups" size={22} className="text-[var(--primary)]" />
            </div>
            <h4 className="font-bold text-sm text-[var(--foreground)]">Readiness Cohorte</h4>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {avgReadiness != null ? `${avgReadiness}%` : '—'}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            État de forme global optimal pour l'entraînement intensif.
          </p>
        </div>

        {/* Dernière Sync */}
        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Icon name="history" size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h4 className="font-bold text-sm text-[var(--foreground)]">Dernière Sync</h4>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {lastSync?.date ? (new Date(lastSync.date).toDateString() === new Date().toDateString() ? "Aujourd'hui" : formatDateFr(lastSync.date)) : '—'}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {lastSync ? `${lastSync.athlete ?? 'Inconnu'} via HRV4T` : 'Aucune synchronisation récente.'}
          </p>
        </div>
      </div>
    </div>
  )
}
