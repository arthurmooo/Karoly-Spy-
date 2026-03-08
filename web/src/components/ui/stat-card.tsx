import { Card } from './card'
import { Icon } from './icon'

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  accent?: boolean
}

export default function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4" padding="sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          accent
            ? 'bg-orange-100 text-[var(--accent)] dark:bg-orange-950/30'
            : 'bg-[rgba(36,0,102,0.08)] text-[var(--primary)] dark:bg-[rgba(167,139,250,0.15)]'
        }`}
      >
        <Icon name={icon} size={20} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
        <p className="text-xl font-semibold text-[var(--foreground)]">{value}</p>
      </div>
    </Card>
  )
}
