'use client'

import { useEffect, useState, useCallback } from 'react'
import SessionChart from '@/components/intervals/session-chart'
import ManualDetector from '@/components/intervals/manual-detector'
import type { StreamData, DetectedSegment } from '@/services/intervals'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'

interface Props {
  activityId: string
  sportType: string
  hasFitFile: boolean
}

export default function ActivityDetailClient({
  activityId,
  sportType,
  hasFitFile,
}: Props) {
  const [streams, setStreams] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [segments, setSegments] = useState<DetectedSegment[]>([])

  useEffect(() => {
    if (!hasFitFile) return
    setLoading(true)
    fetch(`/api/activities/${activityId}/streams`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Erreur chargement FIT')
        }
        return res.json()
      })
      .then((data: StreamData) => setStreams(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [activityId, hasFitFile])

  const handleSegmentsFound = useCallback(
    (segs: DetectedSegment[]) => setSegments(segs),
    []
  )

  if (!hasFitFile) {
    return (
      <Card className="text-center text-sm text-[var(--muted-foreground)]">
        Aucun fichier FIT disponible pour cette activite.
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted-foreground)]">
        <Icon name="progress_activity" size={16} className="animate-spin" />
        Chargement des donnees...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!streams) return null

  return (
    <div className="space-y-8">
      {/* Chart */}
      <Card padding="sm">
        <SessionChart
          streams={streams}
          segments={segments}
          sportType={sportType}
        />
      </Card>

      {/* Manual detector */}
      <Card padding="sm">
        <ManualDetector
          streams={streams}
          sportType={sportType}
          activityId={activityId}
          onSegmentsFound={handleSegmentsFound}
        />
      </Card>
    </div>
  )
}
