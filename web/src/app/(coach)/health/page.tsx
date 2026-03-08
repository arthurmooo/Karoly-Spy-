import { getAthletes } from '@/services/athletes'
import { getHealthRadar } from '@/repositories/hrv'
import AthleteSelector from '@/components/physio/athlete-selector'
import HealthTable from '@/components/health/health-table'
import CsvUpload from '@/components/health/csv-upload'
import StatCard from '@/components/ui/stat-card'

export const dynamic = 'force-dynamic'

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>
}) {
  const params = await searchParams
  const athleteId = params.athlete || null

  const [athletes, radarRows] = await Promise.all([
    getAthletes(),
    getHealthRadar(),
  ])

  const filteredRows = athleteId
    ? radarRows.filter((r) => r.athlete_id === athleteId)
    : radarRows

  const alertCount = radarRows.filter((r) => r.tendance_rmssd_pct != null && r.tendance_rmssd_pct < -10).length
  const avgReadiness = radarRows.length > 0
    ? (radarRows.filter((r) => r.rmssd_matinal != null).reduce((a, r) => a + (r.rmssd_matinal ?? 0), 0) / radarRows.filter((r) => r.rmssd_matinal != null).length).toFixed(0)
    : '--'
  const lastSync = radarRows.length > 0 ? radarRows[0]?.date ?? '--' : '--'

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
        Suivi Biometrique & Readiness
      </h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Donnees de sante et readiness des athletes
      </p>

      <AthleteSelector athletes={athletes} />

      <div className="mt-2">
        <HealthTable rows={filteredRows} />
      </div>

      {/* CSV Import */}
      {athleteId && (
        <div className="mt-8">
          <CsvUpload />
        </div>
      )}

      {/* Summary cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Alertes de Sante"
          value={alertCount}
          icon="health_and_safety"
          accent={alertCount > 0}
        />
        <StatCard
          label="Readiness Cohorte"
          value={avgReadiness}
          icon="monitor_heart"
        />
        <StatCard
          label="Derniere Sync"
          value={lastSync}
          icon="sync"
        />
      </div>
    </>
  )
}
