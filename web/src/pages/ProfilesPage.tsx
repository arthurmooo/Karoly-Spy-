import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { speedToPace, paceToSpeed } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import type { PhysioProfile } from '@/types'

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProfilesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const athleteId = searchParams.get('athlete') ?? ''
  const [athletes, setAthletes] = useState<any[]>([])
  const [profiles, setProfiles] = useState<PhysioProfile[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const athletesRes = await supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true).order('last_name')
    setAthletes(athletesRes.data ?? [])

    if (athleteId) {
      const profilesRes = await supabase.from('physio_profiles').select('*').eq('athlete_id', athleteId).order('valid_from', { ascending: false })
      setProfiles(profilesRes.data ?? [])
    } else {
      setProfiles([])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [athleteId])

  const bikeProfiles = profiles.filter((p) => p.sport.toLowerCase() === 'bike')
  const runProfiles = profiles.filter((p) => p.sport.toLowerCase() === 'run')

  const activeBike = bikeProfiles.find((p) => p.valid_to === null) ?? null
  const activeRun = runProfiles.find((p) => p.valid_to === null) ?? null
  const archivedBike = bikeProfiles.filter((p) => p.valid_to !== null)
  const archivedRun = runProfiles.filter((p) => p.valid_to !== null)

  const selectedAthlete = athletes.find((a) => a.id === athleteId)

  return (
    <>
      {/* Header */}
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        <span>Analyses</span>
        <span>/</span>
        <span className="text-[var(--foreground)]">Profils Physiologiques</span>
      </div>

      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Profils de Performance</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Suivi des seuils métaboliques, FTP et zones de fréquence cardiaque de qualité médicale.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Select
            label="Athlète sélectionné"
            value={athleteId}
            onChange={(e) => {
              const v = e.target.value
              setSearchParams(v ? { athlete: v } : {})
            }}
          >
            <option value="">Sélectionnez un athlète</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
          <Icon name="progress_activity" size={16} className="animate-spin" />
          Chargement...
        </div>
      ) : !athleteId ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Sélectionnez un athlète pour afficher ses profils.</p>
      ) : (
        <>
          {/* Two-column grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SportColumn
              sport="bike"
              active={activeBike}
              archived={archivedBike}
              athleteId={athleteId}
              onSaved={loadData}
            />
            <SportColumn
              sport="run"
              active={activeRun}
              archived={archivedRun}
              athleteId={athleteId}
              onSaved={loadData}
            />
          </div>

          {/* Legend */}
          <Card className="mt-8">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Légende Clinique
            </h3>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="font-semibold text-[var(--foreground)]">LT1</span>
                <span className="ml-2 text-[var(--accent)]">Seuil Aérobie</span>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Point à partir duquel le lactate commence à augmenter au-dessus des niveaux de repos.
                </p>
              </div>
              <div>
                <span className="font-semibold text-[var(--foreground)]">LT2</span>
                <span className="ml-2 text-[var(--accent)]">Seuil Anaérobie</span>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Point d'inflexion où le lactate s'accumule plus vite qu'il ne peut être éliminé (MLSS).
                </p>
              </div>
              <div>
                <span className="font-semibold text-[var(--foreground)]">FTP</span>
                <span className="ml-2 text-[var(--accent)]">Puissance Seuil Fonctionnelle</span>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Puissance maximale pouvant être maintenue en régime quasi-stable pendant environ 1h.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  )
}

/* ─── Sport Column ─── */

function SportColumn({
  sport,
  active,
  archived,
  athleteId,
  onSaved,
}: {
  sport: 'bike' | 'run'
  active: PhysioProfile | null
  archived: PhysioProfile[]
  athleteId: string
  onSaved: () => void
}) {
  const isBike = sport === 'bike'
  const label = isBike ? 'Vélo' : 'Course'
  const icon = isBike ? 'pedal_bike' : 'directions_run'
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      {/* Column header with add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--muted)]">
            <Icon name={icon} size={18} className="text-[var(--foreground)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">{label}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={showForm ? 'close' : 'add'}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Annuler' : 'Ajouter'}
        </Button>
      </div>

      {/* Collapsible form */}
      {showForm && (
        <AddProfileForm
          sport={sport}
          athleteId={athleteId}
          onSaved={() => { setShowForm(false); onSaved() }}
        />
      )}

      {/* Active profile card */}
      {active ? (
        <ActiveProfileCard profile={active} sport={sport} />
      ) : (
        <Card className="border-dashed">
          <p className="text-sm text-[var(--muted-foreground)]">Aucun profil actif</p>
        </Card>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div className="space-y-2">
          {archived.map((p) => (
            <ArchivedProfileRow key={p.id} profile={p} sport={sport} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Active Profile Card ─── */

function ActiveProfileCard({ profile, sport }: { profile: PhysioProfile; sport: 'bike' | 'run' }) {
  const isBike = sport === 'bike'

  const mainValue = isBike
    ? profile.cp_cs != null ? `${Math.round(profile.cp_cs)} W` : '-'
    : profile.lt2_power_pace != null ? speedToPace(profile.lt2_power_pace) ?? '-' : '-'

  const mainSub = isBike
    ? (profile.cp_cs != null && profile.weight != null && profile.weight > 0
        ? `${(profile.cp_cs / profile.weight).toFixed(1)} W/kg`
        : null)
    : 'min/km'

  return (
    <Card className="border-l-4 border-l-orange-500" padding="none">
      <div className="p-5">
        {/* Header row */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {formatDate(profile.valid_from)}
            </p>
          </div>
          <Badge variant="status-active">ACTIF</Badge>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: main metric */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {isBike ? 'FTP Estimée' : 'Seuil Allure'}
            </p>
            <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{mainValue}</p>
            {mainSub && (
              <p className="text-sm text-[var(--muted-foreground)]">{mainSub}</p>
            )}
            {!isBike && profile.vma != null && (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                VMA : <span className="font-medium text-[var(--foreground)]">{profile.vma} km/h</span>
              </p>
            )}
          </div>

          {/* Right: HR thresholds */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Seuils FC
            </p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">LT1 (Aérobie)</span>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {profile.lt1_hr != null ? `${profile.lt1_hr} bpm` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">LT2 (Anaérobie)</span>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {profile.lt2_hr != null ? `${profile.lt2_hr} bpm` : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ─── Archived Profile Row ─── */

function ArchivedProfileRow({ profile, sport }: { profile: PhysioProfile; sport: 'bike' | 'run' }) {
  const isBike = sport === 'bike'
  const metric = isBike
    ? profile.cp_cs != null ? `${Math.round(profile.cp_cs)} W` : '-'
    : profile.lt2_power_pace != null ? speedToPace(profile.lt2_power_pace) ?? '-' : '-'

  return (
    <Card padding="sm" className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon name="history" size={16} className="text-[var(--muted-foreground)]" />
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {isBike ? 'Profil' : 'Profil'} — {metric}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {formatDate(profile.valid_from)} – {formatDate(profile.valid_to)}
          </p>
        </div>
      </div>
      <Badge variant="status-archived">ARCHIVÉ</Badge>
    </Card>
  )
}

/* ─── Add Profile Form ─── */

function AddProfileForm({
  sport,
  athleteId,
  onSaved,
}: {
  sport: 'bike' | 'run'
  athleteId: string
  onSaved: () => void
}) {
  const isBike = sport === 'bike'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bike fields
  const [ftp, setFtp] = useState('')
  const [weight, setWeight] = useState('')
  // Run fields
  const [seuilAllure, setSeuilAllure] = useState('')
  const [vma, setVma] = useState('')
  // Common
  const [lt1Hr, setLt1Hr] = useState('')
  const [lt2Hr, setLt2Hr] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const now = new Date().toISOString()
    const parseNum = (v: string) => v === '' ? null : Number(v)

    let lt2PowerPace: number | null = null
    if (isBike) {
      lt2PowerPace = parseNum(ftp)
    } else {
      if (seuilAllure) {
        const speed = paceToSpeed(seuilAllure)
        if (speed === null) {
          setError('Format allure invalide (ex: 3:55)')
          setLoading(false)
          return
        }
        lt2PowerPace = speed
      }
    }

    try {
      // SCD2: close current active profile
      await supabase
        .from('physio_profiles')
        .update({ valid_to: now })
        .eq('athlete_id', athleteId)
        .ilike('sport', sport)
        .is('valid_to', null)

      // Insert new
      const { error: insertErr } = await supabase.from('physio_profiles').insert({
        athlete_id: athleteId,
        sport: isBike ? 'Bike' : 'Run',
        valid_from: now,
        valid_to: null,
        cp_cs: isBike ? parseNum(ftp) : lt2PowerPace,
        lt2_power_pace: isBike ? null : lt2PowerPace,
        weight: isBike ? parseNum(weight) : null,
        vma: isBike ? null : parseNum(vma),
        lt1_hr: parseNum(lt1Hr),
        lt2_hr: parseNum(lt2Hr),
      })

      if (insertErr) throw insertErr

      // Reset
      setFtp(''); setWeight(''); setSeuilAllure(''); setVma(''); setLt1Hr(''); setLt2Hr('')
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border)] p-5">
      <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
        Ajouter un profil {isBike ? 'Vélo' : 'Course'}
      </h4>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          {isBike ? (
            <>
              <Input label="FTP (W)" type="number" value={ftp} onChange={(e) => setFtp(e.target.value)} placeholder="285" />
              <Input label="Poids (kg)" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="68" />
            </>
          ) : (
            <>
              <Input label="Seuil Allure (mm:ss)" type="text" value={seuilAllure} onChange={(e) => setSeuilAllure(e.target.value)} placeholder="3:55" />
              <Input label="VMA (km/h)" type="number" step="0.1" value={vma} onChange={(e) => setVma(e.target.value)} placeholder="18.5" />
            </>
          )}
          <Input label="FC LT1" type="number" value={lt1Hr} onChange={(e) => setLt1Hr(e.target.value)} placeholder="142" />
          <Input label="FC LT2" type="number" value={lt2Hr} onChange={(e) => setLt2Hr(e.target.value)} placeholder="168" />
        </div>

        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        <Button type="submit" disabled={loading} className="mt-4 w-full" variant="accent">
          {loading ? 'Enregistrement...' : 'Créer le profil'}
        </Button>
      </form>
    </div>
  )
}
