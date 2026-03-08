import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevated?: boolean
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className = '',
  padding = 'md',
  elevated = false,
}: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] ${
        elevated ? 'shadow-[var(--shadow-elevated)]' : 'shadow-[var(--shadow-card)]'
      } ${PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`border-b border-[var(--border)] bg-[var(--muted)] px-5 py-3.5 text-sm font-bold uppercase tracking-tight text-[var(--foreground)] ${className}`}
    >
      {children}
    </div>
  )
}
