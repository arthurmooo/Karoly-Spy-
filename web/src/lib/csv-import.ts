import { supabase } from '@/integrations/supabase/client'

const EXPECTED_HEADERS = ['email', 'date', 'time', 'FC repos', 'rMSSD']

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function parseAndImportCsv(text: string): Promise<ImportResult> {
  const lines = text.split(/\r?\n/)
  if (lines.length < 1) {
    return { imported: 0, skipped: 0, errors: ['Fichier vide'] }
  }

  // Validate header
  const header = lines[0].split(';').map((h) => h.trim())
  const headerMatch = EXPECTED_HEADERS.every(
    (h, i) => header[i]?.toLowerCase() === h.toLowerCase(),
  )
  if (!headerMatch) {
    return {
      imported: 0,
      skipped: 0,
      errors: [
        `Header invalide. Attendu: ${EXPECTED_HEADERS.join(';')} — Reçu: ${lines[0]}`,
      ],
    }
  }

  // Parse data lines
  const errors: string[] = []
  const rowsByEmail = new Map<string, { date: string; resting_hr: number; rmssd: number }[]>()
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line === ';;;;') {
      skipped++
      continue
    }

    const cols = line.split(';')
    if (cols.length < 5) {
      errors.push(`Ligne ${i + 1}: nombre de colonnes insuffisant`)
      skipped++
      continue
    }

    const [email, date, , fcReposStr, rmssdStr] = cols
    if (!email?.trim()) {
      skipped++
      continue
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      errors.push(`Ligne ${i + 1}: date invalide "${date}"`)
      skipped++
      continue
    }

    const resting_hr = parseFloat(fcReposStr)
    const rmssd = parseFloat(rmssdStr)

    if (isNaN(resting_hr) || resting_hr <= 0 || isNaN(rmssd) || rmssd <= 0) {
      errors.push(`Ligne ${i + 1}: FC repos ou rMSSD invalide`)
      skipped++
      continue
    }

    const emailKey = email.trim().toLowerCase()
    if (!rowsByEmail.has(emailKey)) {
      rowsByEmail.set(emailKey, [])
    }
    rowsByEmail.get(emailKey)!.push({
      date: date.trim(),
      resting_hr,
      rmssd,
    })
  }

  // Resolve emails → athlete IDs and upsert
  let totalImported = 0
  const BATCH_SIZE = 200

  for (const [email, rows] of rowsByEmail) {
    // Resolve athlete by email
    const { data: athlete } = await supabase
      .from('athletes')
      .select('id')
      .ilike('email', email)
      .limit(1)
      .single()

    if (!athlete) {
      errors.push(`Email inconnu: ${email} (${rows.length} lignes ignorées)`)
      skipped += rows.length
      continue
    }

    // Deduplicate by (athlete_id, date)
    const deduped = new Map<string, typeof rows[0]>()
    for (const r of rows) {
      deduped.set(`${athlete.id}|${r.date}`, r)
    }
    const uniqueRows = Array.from(deduped.values())

    // Upsert in batches
    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const chunk = uniqueRows.slice(i, i + BATCH_SIZE).map((r) => ({
        athlete_id: athlete.id,
        date: r.date,
        resting_hr: r.resting_hr,
        rmssd: r.rmssd,
      }))

      const { error } = await supabase
        .from('daily_readiness')
        .upsert(chunk, {
          onConflict: 'athlete_id,date',
          ignoreDuplicates: false,
        })

      if (error) {
        errors.push(`Erreur DB pour ${email}: ${error.message}`)
        continue
      }
      totalImported += chunk.length
    }
  }

  return { imported: totalImported, skipped, errors }
}
