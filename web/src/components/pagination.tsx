import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalCount: number
  pageSize: number
  basePath?: string
  filterParams?: Record<string, string>
}

function buildHref(basePath: string, page: number, filterParams: Record<string, string>) {
  const params = new URLSearchParams(filterParams)
  params.set('page', String(page))
  return `${basePath}?${params.toString()}`
}

export default function Pagination({
  currentPage,
  totalCount,
  pageSize,
  basePath = '/activities',
  filterParams = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-sm text-[var(--muted-foreground)]">
        {totalCount} activite{totalCount !== 1 ? 's' : ''} &middot; Page{' '}
        {currentPage} / {totalPages}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={buildHref(basePath, currentPage - 1, filterParams)}>
            <Button variant="outline" size="sm" icon="chevron_left">
              Precedent
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" icon="chevron_left" disabled>
            Precedent
          </Button>
        )}
        {hasNext ? (
          <Link href={buildHref(basePath, currentPage + 1, filterParams)}>
            <Button variant="outline" size="sm">
              Suivant
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Suivant
          </Button>
        )}
      </div>
    </div>
  )
}
