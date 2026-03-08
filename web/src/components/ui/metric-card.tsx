import { ReactNode } from 'react'
import { Card } from './card'

interface MetricCardProps { label: string; value: ReactNode; className?: string }

export function MetricCard({ label, value, className = '' }: MetricCardProps) {
  return (
    <Card className={`flex flex-col justify-center ${className}`} padding="sm">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">{value}</span>
    </Card>
  )
}
