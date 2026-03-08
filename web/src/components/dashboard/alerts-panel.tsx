import type { FleetAlert } from '@/repositories/dashboard'
import { Icon } from '@/components/ui/icon'

export default function AlertsPanel({ alerts }: { alerts: FleetAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-green-50 px-4 py-3 dark:bg-green-950/20">
        <Icon name="check_circle" size={20} className="shrink-0 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          Aucune alerte — tout est OK
        </span>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.athlete_id}
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-orange-50/50 px-4 py-3 dark:bg-orange-950/10"
        >
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {alert.athlete_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{alert.message}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
