'use client'

import { useState, useCallback } from 'react'
import {
  findBestSegments,
  findBestSegmentsByDistance,
  type StreamData,
  type DetectedSegment,
  type MetricKey,
} from '@/services/intervals'
import { speedToPace } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/table'

interface ManualDetectorProps {
  streams: StreamData
  sportType: string
  activityId: string
  onSegmentsFound: (segments: DetectedSegment[]) => void
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatMetricValue(
  value: number | null,
  metric: MetricKey,
  sportType: string
): string {
  if (value == null) return '--'
  if (metric === 'heart_rate') return `${Math.round(value)} bpm`
  if (metric === 'power') return `${Math.round(value)} W`
  if (sportType === 'swim') {
    const secPer100 = 100 / value
    const min = Math.floor(secPer100 / 60)
    const sec = Math.round(secPer100 % 60)
    return `${min}'${sec.toString().padStart(2, '0')}/100m`
  }
  return speedToPace(value) ? `${speedToPace(value)}/km` : '--'
}

function defaultMetric(sportType: string): MetricKey {
  if (sportType === 'bike') return 'power'
  return 'speed'
}

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'speed', label: 'Allure' },
  { value: 'power', label: 'Puissance' },
  { value: 'heart_rate', label: 'FC' },
]

export default function ManualDetector({
  streams,
  sportType,
  activityId,
  onSegmentsFound,
}: ManualDetectorProps) {
  const [metric, setMetric] = useState<MetricKey>(defaultMetric(sportType))
  const [count, setCount] = useState(5)
  const [searchMode, setSearchMode] = useState<'duration' | 'distance'>('duration')
  const [durationInput, setDurationInput] = useState('3:00')
  const [distanceInput, setDistanceInput] = useState('5.0')
  const [segments, setSegments] = useState<DetectedSegment[]>([])
  const [injecting, setInjecting] = useState(false)
  const [injected, setInjected] = useState(false)

  const parseDuration = (input: string): number | null => {
    const match = input.trim().match(/^(\d{1,3}):(\d{2})$/)
    if (!match) return null
    return parseInt(match[1]) * 60 + parseInt(match[2])
  }

  const handleSearch = useCallback(() => {
    let results: DetectedSegment[]

    if (searchMode === 'distance') {
      const km = parseFloat(distanceInput)
      if (isNaN(km) || km <= 0) return
      results = findBestSegmentsByDistance(streams, metric, km * 1000, count)
    } else {
      const durationSec = parseDuration(durationInput)
      if (!durationSec || durationSec <= 0) return
      results = findBestSegments(streams, metric, durationSec, count)
    }

    setSegments(results)
    setInjected(false)
    onSegmentsFound(results)
  }, [streams, metric, count, searchMode, durationInput, distanceInput, onSegmentsFound])

  const handleInject = async () => {
    if (segments.length === 0) return
    setInjecting(true)

    try {
      const payload: Record<string, number | null> = {}

      if (metric === 'speed' || sportType !== 'bike') {
        const totalDuration = segments.reduce(
          (acc, s) => acc + (s.endSec - s.startSec + 1),
          0
        )
        const totalSpeed = segments.reduce(
          (acc, s) => acc + (s.avgSpeed ?? 0) * (s.endSec - s.startSec + 1),
          0
        )
        const meanSpeed = totalDuration > 0 ? totalSpeed / totalDuration : null
        const lastSegment = segments[segments.length - 1]

        payload.manual_interval_pace_mean = meanSpeed
        payload.manual_interval_pace_last = lastSegment.avgSpeed
      }

      if (metric === 'power' || sportType === 'bike') {
        const totalDuration = segments.reduce(
          (acc, s) => acc + (s.endSec - s.startSec + 1),
          0
        )
        const totalPower = segments.reduce(
          (acc, s) => acc + (s.avgPower ?? 0) * (s.endSec - s.startSec + 1),
          0
        )
        const meanPower = totalDuration > 0 ? totalPower / totalDuration : null
        const lastSegment = segments[segments.length - 1]

        payload.manual_interval_power_mean = meanPower
        payload.manual_interval_power_last = lastSegment.avgPower
      }

      const res = await fetch(`/api/activities/${activityId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setInjected(true)
      }
    } finally {
      setInjecting(false)
    }
  }

  const summaryMean =
    segments.length > 0
      ? segments.reduce((a, s) => a + s.avgValue, 0) / segments.length
      : null
  const summaryLast =
    segments.length > 0 ? segments[segments.length - 1].avgValue : null

  const inputCls =
    'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(36,0,102,0.2)] dark:focus:ring-[rgba(167,139,250,0.2)]'

  return (
    <div className="space-y-6">
      {/* Form */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Detection Manuelle
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Mode
            </label>
            <div className="flex h-10 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
              <button
                type="button"
                onClick={() => setSearchMode('duration')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  searchMode === 'duration'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                Duree
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('distance')}
                className={`border-l border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors ${
                  searchMode === 'distance'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                Distance
              </button>
            </div>
          </div>
          <div className="min-w-[120px]">
            <Select
              label="Metrique"
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
            >
              {METRIC_OPTIONS.filter((o) =>
                streams[o.value].some((v) => v != null)
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Segments
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className={`${inputCls} w-20`}
            />
          </div>
          {searchMode === 'duration' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Duree (M:SS)
              </label>
              <input
                type="text"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                placeholder="3:00"
                className={`${inputCls} w-24`}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Distance (km)
              </label>
              <input
                type="text"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                placeholder="5.0"
                className={`${inputCls} w-24`}
              />
            </div>
          )}
          <Button type="button" onClick={handleSearch}>
            Rechercher
          </Button>
        </div>
      </div>

      {/* Results table */}
      {segments.length > 0 && (
        <div>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>#</TableHeaderCell>
                <TableHeaderCell>Debut</TableHeaderCell>
                <TableHeaderCell>Fin</TableHeaderCell>
                <TableHeaderCell>
                  {METRIC_OPTIONS.find((o) => o.value === metric)?.label}
                </TableHeaderCell>
                <TableHeaderCell>FC</TableHeaderCell>
                <TableHeaderCell>
                  {sportType === 'bike' ? 'Puissance' : 'Allure'}
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {segments.map((seg, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-[var(--muted-foreground)]">
                    {i + 1}
                  </TableCell>
                  <TableCell>{formatSec(seg.startSec)}</TableCell>
                  <TableCell>{formatSec(seg.endSec)}</TableCell>
                  <TableCell className="font-medium text-[var(--foreground)]">
                    {formatMetricValue(seg.avgValue, metric, sportType)}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {seg.avgHr != null ? `${Math.round(seg.avgHr)} bpm` : '--'}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {sportType === 'bike'
                      ? seg.avgPower != null
                        ? `${Math.round(seg.avgPower)} W`
                        : '--'
                      : speedToPace(seg.avgSpeed) ?? '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Summary */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-[var(--muted-foreground)]">
              Moy:{' '}
              <span className="font-medium text-[var(--foreground)]">
                {formatMetricValue(summaryMean, metric, sportType)}
              </span>
            </span>
            <span className="text-[var(--muted-foreground)]">
              Last:{' '}
              <span className="font-medium text-[var(--foreground)]">
                {formatMetricValue(summaryLast, metric, sportType)}
              </span>
            </span>
            <Button
              type="button"
              variant={injected ? 'primary' : 'accent'}
              onClick={handleInject}
              disabled={injecting || injected}
              className="ml-auto"
            >
              {injecting
                ? '...'
                : injected
                  ? 'Valeurs injectees'
                  : 'Injecter les valeurs'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
