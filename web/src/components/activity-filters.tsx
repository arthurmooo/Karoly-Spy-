'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const SPORTS = ['run', 'bike', 'swim', 'strength', 'other'] as const

interface ActivityFiltersProps {
  athletes: { id: string; first_name: string; last_name: string }[]
}

export default function ActivityFilters({ athletes }: ActivityFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const pushFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  const reset = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const hasFilters =
    searchParams.has('athlete') ||
    searchParams.has('sport') ||
    searchParams.has('from') ||
    searchParams.has('to')

  return (
    <Card padding="sm" className="mb-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1">
          <Select
            label="Athlete"
            value={searchParams.get('athlete') ?? ''}
            onChange={(e) => pushFilters('athlete', e.target.value)}
          >
            <option value="">Tous les athletes</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Select
            label="Sport"
            value={searchParams.get('sport') ?? ''}
            onChange={(e) => pushFilters('sport', e.target.value)}
          >
            <option value="">Tous les sports</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[150px]">
          <Input
            label="Du"
            type="date"
            value={searchParams.get('from') ?? ''}
            onChange={(e) => pushFilters('from', e.target.value)}
          />
        </div>

        <div className="min-w-[150px]">
          <Input
            label="Au"
            type="date"
            value={searchParams.get('to') ?? ''}
            onChange={(e) => pushFilters('to', e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" onClick={reset}>
            Reinitialiser
          </Button>
        )}
      </div>
    </Card>
  )
}
