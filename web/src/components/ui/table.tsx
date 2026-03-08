import { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] ${className}`}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-[var(--border)] bg-[var(--muted)] text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{children}</thead>
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
}

export function TableRow({ children, className = '', ...props }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <tr className={`bg-[var(--card)] transition-colors hover:bg-[rgba(36,0,102,0.04)] dark:hover:bg-[rgba(167,139,250,0.06)] ${className}`} {...props}>{children}</tr>
}

export function TableHeaderCell({ children, className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return <th className={`px-4 py-3 ${className}`} {...props}>{children}</th>
}

export function TableCell({ children, className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return <td className={`px-4 py-3 ${className}`} {...props}>{children}</td>
}
