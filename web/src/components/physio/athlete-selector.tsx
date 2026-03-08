'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/select'

interface AthleteSelectorProps {
  athletes: { id: string; first_name: string; last_name: string }[]
}

export default function AthleteSelector({ athletes }: AthleteSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('athlete', value)
    } else {
      params.delete('athlete')
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="mb-8 max-w-sm">
      <Select
        label="Athlete"
        value={searchParams.get('athlete') ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selectionnez un athlete</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.first_name} {a.last_name}
          </option>
        ))}
      </Select>
    </div>
  )
}
