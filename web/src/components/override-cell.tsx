'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { speedToPace, paceToSpeed } from '@/lib/utils'

interface OverrideCellProps {
  activityId: string
  sportType: string
  paceMean: number | null
  paceLast: number | null
  powerMean: number | null
  hasOverride: boolean
}

export default function OverrideCell({
  activityId,
  sportType,
  paceMean,
  paceLast,
  powerMean,
  hasOverride: initialHasOverride,
}: OverrideCellProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasOverride, setHasOverride] = useState(initialHasOverride)
  const [displayMean, setDisplayMean] = useState(paceMean)
  const [displayLast, setDisplayLast] = useState(paceLast)
  const [displayPowerMean, setDisplayPowerMean] = useState(powerMean)
  const popoverRef = useRef<HTMLDivElement>(null)
  const cellRef = useRef<HTMLTableCellElement>(null)

  const isBike = sportType === 'bike'

  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')

  useEffect(() => {
    if (!open) return
    if (isBike) {
      setInputA(displayPowerMean != null ? String(Math.round(displayPowerMean)) : '')
      setInputB('')
    } else {
      setInputA(speedToPace(displayMean)?.replace("'", ':') ?? '')
      setInputB(speedToPace(displayLast)?.replace("'", ':') ?? '')
    }
  }, [open, isBike, displayMean, displayLast, displayPowerMean])

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        cellRef.current &&
        !cellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    },
    []
  )

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    },
    []
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, handleClickOutside, handleEscape])

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, number | null> = {}

      if (isBike) {
        const watts = inputA ? parseFloat(inputA) : null
        if (inputA && (watts == null || isNaN(watts))) return
        payload.manual_interval_power_mean = watts
      } else {
        const speedMean = inputA ? paceToSpeed(inputA) : null
        const speedLast = inputB ? paceToSpeed(inputB) : null
        if (inputA && speedMean == null) return
        if (inputB && speedLast == null) return
        payload.manual_interval_pace_mean = speedMean
        payload.manual_interval_pace_last = speedLast
      }

      const res = await fetch(`/api/activities/${activityId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) return

      if (isBike) {
        setDisplayPowerMean(payload.manual_interval_power_mean ?? displayPowerMean)
      } else {
        if (payload.manual_interval_pace_mean !== undefined)
          setDisplayMean(payload.manual_interval_pace_mean)
        if (payload.manual_interval_pace_last !== undefined)
          setDisplayLast(payload.manual_interval_pace_last)
      }
      setHasOverride(true)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      const payload: Record<string, null> = isBike
        ? { manual_interval_power_mean: null, manual_interval_power_last: null }
        : { manual_interval_pace_mean: null, manual_interval_pace_last: null }

      const res = await fetch(`/api/activities/${activityId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) return
      setHasOverride(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function formatDisplay(): string {
    if (isBike) {
      return displayPowerMean != null ? `${Math.round(displayPowerMean)} W` : '\u2014'
    }
    const meanStr = speedToPace(displayMean)
    const lastStr = speedToPace(displayLast)
    if (!meanStr) return '\u2014'
    return lastStr ? `${meanStr} / ${lastStr}` : meanStr
  }

  const inputCls =
    'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(36,0,102,0.2)] dark:focus:ring-[rgba(167,139,250,0.2)]'

  return (
    <td
      ref={cellRef}
      className="relative hidden whitespace-nowrap px-4 py-3 text-right md:table-cell"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`cursor-pointer rounded-[var(--radius-sm)] px-1 py-0.5 text-sm hover:bg-[var(--muted)] ${
          hasOverride
            ? 'font-medium text-[var(--accent)]'
            : 'text-[var(--muted-foreground)]'
        }`}
      >
        {formatDisplay()}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-dropdown)]"
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            {isBike ? 'Override Puissance' : 'Override Allure'}
          </p>

          {isBike ? (
            <div className="space-y-2">
              <label className="block text-xs text-[var(--muted-foreground)]">
                Puiss. Moy (W)
              </label>
              <input
                type="number"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                placeholder="ex: 267"
                className={inputCls}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)]">
                  Allure Moy (M:SS)
                </label>
                <input
                  type="text"
                  value={inputA}
                  onChange={(e) => setInputA(e.target.value)}
                  placeholder="ex: 4:15"
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)]">
                  Allure Last (M:SS)
                </label>
                <input
                  type="text"
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                  placeholder="ex: 4:08"
                  className={`mt-1 ${inputCls}`}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            {hasOverride && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="text-xs text-[var(--muted-foreground)] underline hover:text-[var(--foreground)]"
              >
                Reinitialiser
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="ml-auto rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? '...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </td>
  )
}
