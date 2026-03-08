import { ReactNode } from 'react'

type BadgeVariant =
  | 'sport-run' | 'sport-bike' | 'sport-swim'
  | 'type-endurance' | 'type-intervals' | 'type-competition' | 'type-recovery' | 'type-test'
  | 'status-active' | 'status-archived'
  | 'success' | 'warning' | 'danger' | 'default'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  'sport-run': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'sport-bike': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'sport-swim': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'type-endurance': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'type-intervals': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'type-competition': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'type-recovery': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'type-test': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'status-active': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  'status-archived': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

interface BadgeProps { children: ReactNode; variant?: BadgeVariant; className?: string }

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-block rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </span>
  )
}

export const SPORT_BADGE_VARIANT: Record<string, BadgeVariant> = { run: 'sport-run', bike: 'sport-bike', swim: 'sport-swim' }
export const TYPE_BADGE_VARIANT: Record<string, BadgeVariant> = { endurance: 'type-endurance', intervals: 'type-intervals', competition: 'type-competition', recovery: 'type-recovery', test: 'type-test' }
