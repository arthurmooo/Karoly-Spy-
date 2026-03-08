import Link from 'next/link'
import { formatDuration } from '@/lib/utils'
import type { RecentActivity } from '@/repositories/dashboard'
import { Icon } from '@/components/ui/icon'
import { Badge, SPORT_BADGE_VARIANT } from '@/components/ui/badge'

const SPORT_ICON: Record<string, string> = {
  run: 'directions_run',
  bike: 'directions_bike',
  swim: 'pool',
}

function MlsBadge({ mls }: { mls: number | null }) {
  if (mls == null) return null
  const variant =
    mls > 150 ? 'danger' as const
      : mls > 100 ? 'warning' as const
        : 'default' as const
  return <Badge variant={variant}>{mls.toFixed(0)}</Badge>
}

export default function ActivityFeed({ activities }: { activities: RecentActivity[] }) {
  if (activities.length === 0) {
    return <p className="py-4 text-sm text-[var(--muted-foreground)]">Aucune activite recente.</p>
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {activities.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(36,0,102,0.08)] text-[var(--primary)] dark:bg-[rgba(167,139,250,0.15)]">
            <Icon name={SPORT_ICON[a.sport_type] ?? 'sports'} size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={`/activities/${a.id}`}
              className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              {a.athlete_name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
              {a.session_date}
              {a.duration_sec ? ` · ${formatDuration(a.duration_sec)}` : ''}
              {a.work_type ? ` · ${a.work_type}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={SPORT_BADGE_VARIANT[a.sport_type] ?? 'default'}>
              {a.sport_type}
            </Badge>
            <MlsBadge mls={a.load_index} />
          </div>
        </li>
      ))}
    </ul>
  )
}
