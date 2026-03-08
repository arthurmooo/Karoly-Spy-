'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import type { StreamData, DetectedSegment } from '@/services/intervals'

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function speedToPace(ms: number): string {
  if (ms <= 0) return '--'
  const totalSec = 1000 / ms
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)
  return `${min}'${sec.toString().padStart(2, '0')}`
}

interface SessionChartProps {
  streams: StreamData
  segments: DetectedSegment[]
  sportType: string
}

type SeriesKey = 'heart_rate' | 'speed' | 'power'

const SERIES_CONFIG: Record<
  SeriesKey,
  { label: string; color: string; yAxisId: string }
> = {
  heart_rate: { label: 'FC', color: '#ef4444', yAxisId: 'hr' },
  speed: { label: 'Allure', color: '#2563eb', yAxisId: 'speed' },
  power: { label: 'Puissance', color: '#22c55e', yAxisId: 'power' },
}

export default function SessionChart({
  streams,
  segments,
  sportType,
}: SessionChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    heart_rate: true,
    speed: true,
    power: sportType === 'bike',
  })

  const data = useMemo(() => {
    const n = streams.elapsed_sec.length
    const step = Math.max(1, Math.floor(n / 1000))
    const result = []
    for (let i = 0; i < n; i += step) {
      result.push({
        sec: streams.elapsed_sec[i],
        heart_rate: streams.heart_rate[i],
        speed: streams.speed[i],
        power: streams.power[i],
        altitude: streams.altitude?.[i] ?? null,
      })
    }
    return result
  }, [streams])

  const hasData = (key: SeriesKey) =>
    streams[key].some((v) => v != null)

  const hasAltitude = streams.altitude?.some((v) => v != null) ?? false

  const availableSeries = (Object.keys(SERIES_CONFIG) as SeriesKey[]).filter(hasData)

  const toggle = (key: SeriesKey) =>
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      {/* Legend / toggles */}
      <div className="mb-3 flex flex-wrap gap-3">
        {availableSeries.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1 text-xs font-medium transition-colors ${
              visibleSeries[key]
                ? 'border-transparent bg-[var(--muted)] text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)]'
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: visibleSeries[key]
                  ? SERIES_CONFIG[key].color
                  : '#a1a1aa',
              }}
            />
            {SERIES_CONFIG[key].label}
          </button>
        ))}
      </div>

      <div className="h-[300px] w-full md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="sec"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={formatTime}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              minTickGap={60}
            />
            {visibleSeries.heart_rate && hasData('heart_rate') && (
              <YAxis
                yAxisId="hr"
                orientation="left"
                stroke="#ef4444"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                width={40}
              />
            )}
            {visibleSeries.speed && hasData('speed') && (
              <YAxis
                yAxisId="speed"
                orientation="right"
                stroke="#2563eb"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                width={40}
              />
            )}
            {visibleSeries.power && hasData('power') && (
              <YAxis
                yAxisId="power"
                orientation="right"
                stroke="#22c55e"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                width={40}
                hide={visibleSeries.speed && hasData('speed')}
              />
            )}
            {hasAltitude && (
              <YAxis
                yAxisId="alt"
                orientation="left"
                hide
                domain={['dataMin', 'dataMax']}
              />
            )}
            {hasAltitude && (
              <Area
                yAxisId="alt"
                type="monotone"
                dataKey="altitude"
                fill="#a1a1aa"
                fillOpacity={0.15}
                stroke="#a1a1aa"
                strokeWidth={0.5}
                strokeOpacity={0.3}
                connectNulls
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Tooltip
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(value, name) => {
                const v = Number(value)
                if (name === 'speed')
                  return [speedToPace(v), 'Allure']
                if (name === 'heart_rate')
                  return [`${Math.round(v)} bpm`, 'FC']
                if (name === 'power')
                  return [`${Math.round(v)} W`, 'Puissance']
                if (name === 'altitude')
                  return [`${Math.round(v)} m`, 'Altitude']
                return [v, name]
              }}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
              }}
            />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={i}
                x1={seg.startSec}
                x2={seg.endSec}
                yAxisId={
                  visibleSeries.heart_rate && hasData('heart_rate')
                    ? 'hr'
                    : visibleSeries.speed && hasData('speed')
                      ? 'speed'
                      : 'power'
                }
                fill="#ff6b00"
                fillOpacity={0.15}
                stroke="#ff6b00"
                strokeOpacity={0.4}
              />
            ))}
            {visibleSeries.heart_rate && hasData('heart_rate') && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="heart_rate"
                stroke="#ef4444"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
            {visibleSeries.speed && hasData('speed') && (
              <Line
                yAxisId="speed"
                type="monotone"
                dataKey="speed"
                stroke="#2563eb"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
            {visibleSeries.power && hasData('power') && (
              <Line
                yAxisId={
                  visibleSeries.speed && hasData('speed') ? 'speed' : 'power'
                }
                type="monotone"
                dataKey="power"
                stroke="#22c55e"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
