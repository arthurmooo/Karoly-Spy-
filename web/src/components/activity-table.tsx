import Link from 'next/link'
import { formatDuration, formatDistance } from '@/lib/utils'
import OverrideCell from '@/components/override-cell'
import { Badge, SPORT_BADGE_VARIANT, TYPE_BADGE_VARIANT } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/table'

type ActivityRow = {
  id: string
  session_date: string
  sport_type: string
  work_type: string | null
  activity_name: string | null
  duration_sec: number | null
  distance_m: number | null
  load_index: number | null
  avg_hr: number | null
  avg_power: number | null
  interval_pace_mean: number | null
  interval_pace_last: number | null
  manual_interval_pace_mean: number | null
  manual_interval_pace_last: number | null
  manual_interval_power_mean: number | null
  manual_interval_power_last: number | null
  rpe: number | null
  athletes: { first_name: string; last_name: string }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export default function ActivityTable({
  activities,
}: {
  activities: ActivityRow[]
}) {
  if (activities.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
        Aucune activite trouvee.
      </p>
    )
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Athlete</TableHeaderCell>
          <TableHeaderCell>Sport</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell className="hidden md:table-cell">Seance</TableHeaderCell>
          <TableHeaderCell className="hidden md:table-cell">Duree</TableHeaderCell>
          <TableHeaderCell className="hidden md:table-cell">Distance</TableHeaderCell>
          <TableHeaderCell className="text-right">MLS</TableHeaderCell>
          <TableHeaderCell className="hidden md:table-cell">Type</TableHeaderCell>
          <TableHeaderCell className="hidden text-right md:table-cell">RPE</TableHeaderCell>
          <TableHeaderCell className="hidden text-right md:table-cell">FC moy</TableHeaderCell>
          <TableHeaderCell className="hidden text-right md:table-cell">Allure / Puiss.</TableHeaderCell>
          <TableHeaderCell className="w-8" />
        </tr>
      </TableHead>
      <TableBody>
        {activities.map((a) => (
          <TableRow key={a.id} className="group cursor-pointer">
            <TableCell className="whitespace-nowrap font-medium text-[var(--foreground)]">
              <Link href={`/activities/${a.id}`} className="hover:text-[var(--primary)]">
                {a.athletes.first_name} {a.athletes.last_name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={SPORT_BADGE_VARIANT[a.sport_type] ?? 'default'}>
                {a.sport_type}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-[var(--muted-foreground)]">
              {formatDate(a.session_date)}
            </TableCell>
            <TableCell className="hidden max-w-[200px] truncate text-[var(--muted-foreground)] md:table-cell">
              {a.activity_name ?? '\u2014'}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-[var(--muted-foreground)] md:table-cell">
              {formatDuration(a.duration_sec) ?? '\u2014'}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-[var(--muted-foreground)] md:table-cell">
              {formatDistance(a.distance_m) ?? '\u2014'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right font-medium text-[var(--foreground)]">
              {a.load_index != null ? a.load_index.toFixed(1) : '\u2014'}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {a.work_type ? (
                <Badge variant={TYPE_BADGE_VARIANT[a.work_type] ?? 'default'}>
                  {a.work_type}
                </Badge>
              ) : (
                '\u2014'
              )}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-right text-[var(--muted-foreground)] md:table-cell">
              {a.rpe ?? '\u2014'}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-right text-[var(--muted-foreground)] md:table-cell">
              {a.avg_hr != null ? `${Math.round(a.avg_hr)} bpm` : '\u2014'}
            </TableCell>
            <OverrideCell
              activityId={a.id}
              sportType={a.sport_type}
              paceMean={a.manual_interval_pace_mean ?? a.interval_pace_mean}
              paceLast={a.manual_interval_pace_last ?? a.interval_pace_last}
              powerMean={a.manual_interval_power_mean ?? a.avg_power}
              hasOverride={
                a.manual_interval_pace_mean != null ||
                a.manual_interval_pace_last != null ||
                a.manual_interval_power_mean != null ||
                a.manual_interval_power_last != null
              }
            />
            <TableCell className="w-8 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
              <Link href={`/activities/${a.id}`} aria-label="Voir le detail">
                <Icon name="chevron_right" size={16} />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
