'use client'

import { useState, useRef } from 'react'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

type ImportStatus =
  | { state: 'idle' }
  | { state: 'uploading' }
  | { state: 'success'; imported: number; skipped: number; errors: string[] }
  | { state: 'error'; message: string }

export default function CsvUpload() {
  const [status, setStatus] = useState<ImportStatus>({ state: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setStatus({ state: 'error', message: 'Le fichier doit etre un .csv' })
      return
    }

    setStatus({ state: 'uploading' })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/hrv/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setStatus({ state: 'error', message: data.error ?? 'Erreur inconnue' })
        return
      }

      setStatus({
        state: 'success',
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors ?? [],
      })
    } catch {
      setStatus({ state: 'error', message: 'Erreur reseau' })
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
        Import HRV4Training
      </h2>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Glisser un fichier CSV exporte depuis HRV4Training
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex cursor-pointer flex-col items-center justify-center
          rounded-[var(--radius-xl)] border-2 border-dashed px-6 py-16 transition-colors
          ${
            dragOver
              ? 'border-[var(--primary)] bg-[rgba(36,0,102,0.05)] dark:bg-[rgba(167,139,250,0.08)]'
              : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]'
          }
        `}
      >
        <Icon name="cloud_upload" size={40} className="mb-3 text-[var(--primary)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">
          Glisser un fichier CSV ici ou{' '}
          <span className="font-semibold text-[var(--primary)] underline">parcourir</span>
        </p>
        <div className="mt-2 flex gap-2">
          <Badge>email</Badge>
          <Badge>date</Badge>
          <Badge>time</Badge>
          <Badge>FC repos</Badge>
          <Badge>rMSSD</Badge>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {/* Status feedback */}
      {status.state === 'uploading' && (
        <div className="mt-4 rounded-[var(--radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          Import en cours...
        </div>
      )}

      {status.state === 'success' && (
        <div className="mt-4 space-y-2">
          <div className="rounded-[var(--radius)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
            {status.imported} ligne{status.imported !== 1 ? 's' : ''} importee
            {status.imported !== 1 ? 's' : ''}
            {status.skipped > 0 && `, ${status.skipped} ignoree${status.skipped !== 1 ? 's' : ''}`}
          </div>
          {status.errors.length > 0 && (
            <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="mb-1 font-medium">Avertissements :</p>
              <ul className="list-inside list-disc space-y-0.5">
                {status.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status.state === 'error' && (
        <div className="mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {status.message}
        </div>
      )}
    </Card>
  )
}
