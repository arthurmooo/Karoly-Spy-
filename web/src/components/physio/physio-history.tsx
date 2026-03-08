'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PhysioProfile } from '@/types'
import { speedToPace, paceToSpeed } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'

interface PhysioHistoryProps {
  sport: 'bike' | 'run'
  profiles: PhysioProfile[]
  athleteId: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatPowerPace(value: number | null, sport: 'bike' | 'run'): string {
  if (value === null || value === undefined) return '-'
  if (sport === 'bike') return `${Math.round(value)} W`
  return speedToPace(value) ?? '-'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

type EditableField =
  | 'lt1_hr'
  | 'lt2_hr'
  | 'lt1_power_pace'
  | 'lt2_power_pace'
  | 'cp_cs'
  | 'weight'
  | 'vma'
  | 'cp_montee'
  | 'cp_ht'

function isRunPaceField(field: EditableField): boolean {
  return field === 'lt1_power_pace' || field === 'lt2_power_pace' || field === 'cp_cs'
}

function getDisplayValue(profile: PhysioProfile, field: EditableField, sport: 'bike' | 'run'): string {
  const raw = profile[field]
  if (raw === null || raw === undefined) return ''
  if (sport === 'run' && isRunPaceField(field)) {
    return speedToPace(raw as number)?.replace("'", ':') ?? ''
  }
  return String(raw)
}

function getCellDisplay(profile: PhysioProfile, field: EditableField, sport: 'bike' | 'run'): string {
  const raw = profile[field]
  if (raw === null || raw === undefined) return '-'
  if (isRunPaceField(field)) return formatPowerPace(raw as number, sport)
  if (field === 'weight') return `${raw} kg`
  if (field === 'vma') return `${raw} km/h`
  if (field === 'cp_montee' || field === 'cp_ht') return `${Math.round(raw as number)} W`
  return String(raw)
}

function parseEditValue(value: string, field: EditableField, sport: 'bike' | 'run'): number | null {
  if (value.trim() === '') return null
  if (sport === 'run' && isRunPaceField(field)) {
    return paceToSpeed(value)
  }
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

export default function PhysioHistory({ sport, profiles, athleteId }: PhysioHistoryProps) {
  const label = sport === 'bike' ? 'Velo' : 'Course a pied'
  const isBike = sport === 'bike'
  const router = useRouter()

  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)

  const activeProfile = profiles.find((p) => p.valid_to === null) ?? null

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingField])

  function startEdit(field: EditableField) {
    if (!activeProfile || saving) return
    setEditingField(field)
    setEditValue(getDisplayValue(activeProfile, field, sport))
  }

  function cancelEdit() {
    setEditingField(null)
    setEditValue('')
  }

  async function commitEdit() {
    if (committingRef.current) return
    if (!activeProfile || !editingField) return

    const parsed = parseEditValue(editValue, editingField, sport)
    const currentRaw = activeProfile[editingField]

    if (parsed === currentRaw) {
      cancelEdit()
      return
    }

    if (sport === 'run' && isRunPaceField(editingField) && editValue.trim() !== '' && parsed === null) {
      cancelEdit()
      return
    }

    committingRef.current = true
    setSaving(true)

    const body = {
      athlete_id: athleteId,
      sport,
      valid_from: today(),
      lt1_hr: activeProfile.lt1_hr,
      lt2_hr: activeProfile.lt2_hr,
      lt1_power_pace: activeProfile.lt1_power_pace,
      lt2_power_pace: activeProfile.lt2_power_pace,
      cp_cs: activeProfile.cp_cs,
      weight: activeProfile.weight,
      vma: activeProfile.vma,
      cp_montee: activeProfile.cp_montee,
      cp_ht: activeProfile.cp_ht,
      [editingField]: parsed,
    }

    try {
      const res = await fetch('/api/physio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        cancelEdit()
        router.refresh()
      }
    } finally {
      setSaving(false)
      committingRef.current = false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  function renderCell(profile: PhysioProfile, field: EditableField) {
    const isActive = profile.valid_to === null
    const isEditing = isActive && editingField === field

    if (isEditing) {
      const useTextInput = sport === 'run' && isRunPaceField(field)
      return (
        <td className="px-4 py-1.5">
          <input
            ref={inputRef}
            type={useTextInput ? 'text' : 'number'}
            step={field === 'weight' || field === 'vma' ? '0.1' : '1'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            disabled={saving}
            className="w-full min-w-[60px] max-w-[100px] rounded-[var(--radius)] border border-[var(--primary)] bg-[var(--card)] px-2 py-1 text-sm tabular-nums text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[rgba(36,0,102,0.2)] dark:focus:ring-[rgba(167,139,250,0.2)]"
          />
        </td>
      )
    }

    const display = getCellDisplay(profile, field, sport)

    if (isActive) {
      return (
        <td
          className="group cursor-pointer px-4 py-2 tabular-nums transition-colors hover:bg-[rgba(36,0,102,0.04)] dark:hover:bg-[rgba(167,139,250,0.06)]"
          onClick={() => startEdit(field)}
          title="Cliquer pour modifier"
        >
          <span className="flex items-center gap-1">
            <span>{display}</span>
            <Icon
              name="edit"
              size={14}
              className="shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
        </td>
      )
    }

    return <td className="px-4 py-2 tabular-nums">{display}</td>
  }

  if (profiles.length === 0) {
    return (
      <Card>
        <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">{label}</h3>
        <p className="text-sm text-[var(--muted-foreground)]">Aucun profil enregistre</p>
      </Card>
    )
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>{label}</CardHeader>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--card)]">
            <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              <th className="px-4 py-2 font-medium">Depuis</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium">FC LT1</th>
              <th className="px-4 py-2 font-medium">FC LT2</th>
              <th className="px-4 py-2 font-medium">{isBike ? 'Puiss. LT1' : 'Allure LT1'}</th>
              <th className="px-4 py-2 font-medium">{isBike ? 'Puiss. LT2' : 'Allure LT2'}</th>
              <th className="px-4 py-2 font-medium">{isBike ? 'CP' : 'CS'}</th>
              <th className="px-4 py-2 font-medium">Poids</th>
              {isBike ? (
                <>
                  <th className="px-4 py-2 font-medium">CP Montee</th>
                  <th className="px-4 py-2 font-medium">CP HT</th>
                </>
              ) : (
                <th className="px-4 py-2 font-medium">VMA</th>
              )}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--border)] text-[var(--foreground)]"
              >
                <td className="px-4 py-2 tabular-nums">{formatDate(p.valid_from)}</td>
                <td className="px-4 py-2">
                  {p.valid_to === null ? (
                    <Badge variant="status-active">Actif</Badge>
                  ) : (
                    <Badge variant="status-archived">Archive</Badge>
                  )}
                </td>
                {renderCell(p, 'lt1_hr')}
                {renderCell(p, 'lt2_hr')}
                {renderCell(p, 'lt1_power_pace')}
                {renderCell(p, 'lt2_power_pace')}
                {renderCell(p, 'cp_cs')}
                {renderCell(p, 'weight')}
                {isBike ? (
                  <>
                    {renderCell(p, 'cp_montee')}
                    {renderCell(p, 'cp_ht')}
                  </>
                ) : (
                  renderCell(p, 'vma')
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
