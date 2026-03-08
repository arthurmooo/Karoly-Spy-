import type { HeatmapData } from '@/services/load'
import { Card } from '@/components/ui/card'

function mlsStyle(normalized: number | null, raw: number | null): {
  style?: React.CSSProperties
  title: string
} {
  if (normalized == null || raw == null) {
    return {
      style: { backgroundColor: '#f1f5f9' },
      title: 'Pas de donnees',
    }
  }
  let bg: string
  if (normalized < 0.25) {
    const t = normalized / 0.25
    bg = blendHex('#f1f5f9', '#bfdbfe', t)
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25
    bg = blendHex('#bfdbfe', '#60a5fa', t)
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25
    bg = blendHex('#60a5fa', '#f97316', t)
  } else {
    const t = (normalized - 0.75) / 0.25
    bg = blendHex('#f97316', '#ea580c', t)
  }
  return {
    style: { backgroundColor: bg },
    title: `MLS: ${raw.toFixed(0)}`,
  }
}

function blendHex(a: string, b: string, t: number): string {
  const r1 = parseInt(a.slice(1, 3), 16)
  const g1 = parseInt(a.slice(3, 5), 16)
  const b1 = parseInt(a.slice(5, 7), 16)
  const r2 = parseInt(b.slice(1, 3), 16)
  const g2 = parseInt(b.slice(3, 5), 16)
  const b2 = parseInt(b.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${bl})`
}

export default function FleetHeatmap({ data }: { data: HeatmapData }) {
  const { athletes, weeks, grid, raw } = data

  if (athletes.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        Aucune donnee de charge disponible.
      </p>
    )
  }

  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--card)] px-3 py-2 text-left font-medium text-[var(--muted-foreground)]">
                Athlete
              </th>
              {weeks.map((w) => (
                <th
                  key={w}
                  className="min-w-[36px] px-0.5 py-2 text-center font-normal text-[var(--muted-foreground)]"
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete, ai) => (
              <tr key={athlete}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                  {athlete.length > 14 ? athlete.slice(0, 14) + '\u2026' : athlete}
                </td>
                {grid[ai].map((val, wi) => {
                  const { style, title } = mlsStyle(val, raw[ai][wi])
                  return (
                    <td key={wi} className="px-0.5 py-0.5">
                      <div
                        className="h-7 w-7 rounded-[var(--radius-sm)]"
                        style={style}
                        title={`${athlete} — Sem ${weeks[wi]} — ${title}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
