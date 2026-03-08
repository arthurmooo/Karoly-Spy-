import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAndImportCsv } from '@/services/hrv'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with a CSV file' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing "file" field in form data' },
      { status: 400 },
    )
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Le fichier doit être un .csv' },
      { status: 400 },
    )
  }

  const text = await file.text()
  if (!text.trim()) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
  }

  try {
    const result = await parseAndImportCsv(text)

    if (result.imported === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors.join('; '), skipped: result.skipped },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (err) {
    console.error('HRV import failed:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'import' },
      { status: 500 },
    )
  }
}
