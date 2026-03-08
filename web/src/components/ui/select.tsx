import { SelectHTMLAttributes, ReactNode } from 'react'
import { Icon } from './icon'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: ReactNode
}

export function Select({
  label,
  children,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className="w-full cursor-pointer appearance-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 pr-10 text-sm font-medium text-[var(--foreground)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(36,0,102,0.2)] hover:border-[var(--muted-foreground)]/30 dark:focus:ring-[rgba(167,139,250,0.2)]"
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--muted-foreground)]">
          <Icon name="expand_more" size={18} />
        </div>
      </div>
    </div>
  )
}
