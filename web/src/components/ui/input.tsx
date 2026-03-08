import { InputHTMLAttributes, forwardRef } from 'react'
import { Icon } from './icon'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon, error, className = '', ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
              <Icon name={icon} size={16} />
            </span>
          )}
          <input
            ref={ref}
            className={`w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(36,0,102,0.2)] hover:border-[var(--muted-foreground)]/30 dark:focus:ring-[rgba(167,139,250,0.2)] ${
              icon ? 'pl-9' : ''
            } ${error ? 'border-red-500' : ''}`}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
