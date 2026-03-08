import type { HealthRadarRow } from '@/repositories/hrv'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/table'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

export default function HealthTable({ rows }: { rows: HealthRadarRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
        Aucune donnee sante disponible.
      </p>
    )
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Athlete</TableHeaderCell>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell className="text-right">rMSSD</TableHeaderCell>
          <TableHeaderCell className="text-right">FC repos</TableHeaderCell>
          <TableHeaderCell className="text-right">Tendance rMSSD</TableHeaderCell>
          <TableHeaderCell className="text-right">Poids</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${r.athlete_id}-${r.date}-${i}`}>
            <TableCell className="whitespace-nowrap font-medium text-[var(--foreground)]">
              {r.athlete ?? '\u2014'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-[var(--muted-foreground)]">
              {r.date ? formatDate(r.date) : '\u2014'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right font-semibold text-[var(--foreground)]">
              {r.rmssd_matinal != null ? r.rmssd_matinal.toFixed(1) : '\u2014'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-[var(--muted-foreground)]">
              {r.fc_repos != null ? `${Math.round(r.fc_repos)} bpm` : '\u2014'}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
              <TendanceBadge value={r.tendance_rmssd_pct} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-[var(--muted-foreground)]">
              {r.poids != null ? `${r.poids} kg` : '\u2014'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TendanceBadge({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[var(--muted-foreground)]">{'\u2014'}</span>
  }

  const isPositive = value >= 0

  return (
    <span className="inline-flex items-center gap-1">
      <Icon
        name={isPositive ? 'trending_up' : 'trending_down'}
        size={14}
        className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
      />
      <Badge variant={isPositive ? 'success' : 'danger'}>
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </Badge>
    </span>
  )
}
