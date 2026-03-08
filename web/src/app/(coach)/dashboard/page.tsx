import { getAthletes } from '@/repositories/athletes'
import { getFleetHeatmapData } from '@/services/load'
import { getRecentActivities, getFleetAlerts } from '@/services/dashboard'
import FleetHeatmap from '@/components/charts/fleet-heatmap'
import StatCard from '@/components/ui/stat-card'
import ActivityFeed from '@/components/dashboard/activity-feed'
import AlertsPanel from '@/components/dashboard/alerts-panel'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [athletes, heatmapData, recentActivities, alerts] = await Promise.all([
    getAthletes(),
    getFleetHeatmapData(12),
    getRecentActivities(48),
    getFleetAlerts(),
  ])

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const weekSessions = recentActivities.filter((a) => a.session_date >= weekAgo).length

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">
        Tableau de Bord
      </h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Athletes actifs"
          value={athletes.length}
          icon="groups"
        />
        <StatCard
          label="Seances cette semaine"
          value={weekSessions}
          icon="cardiology"
        />
        <StatCard
          label={`Alerte${alerts.length !== 1 ? 's' : ''}`}
          value={alerts.length}
          icon="warning"
          accent={alerts.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column: alerts + feed */}
        <div className="space-y-6 lg:col-span-1">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
              Alertes
            </h2>
            <AlertsPanel alerts={alerts} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
              Flux recent (48h)
            </h2>
            <Card padding="none" className="px-4 py-2">
              <ActivityFeed activities={recentActivities} />
            </Card>
          </section>
        </div>

        {/* Right column: heatmap */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
            Charge hebdomadaire (MLS)
          </h2>
          <FleetHeatmap data={heatmapData} />
        </section>
      </div>
    </>
  )
}
