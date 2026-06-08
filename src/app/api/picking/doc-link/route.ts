import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function extractFileId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

// GET /api/picking/doc-link?doc=PV+10382
export async function GET(request: NextRequest) {
  const doc = new URL(request.url).searchParams.get('doc')
  if (!doc) return NextResponse.json(null)
  const supabase = await createClient()
  const { data } = await supabase.from('picking_doc_links').select('drive_url, drive_file_id').eq('documento', doc.trim()).single()
  return NextResponse.json(data)
}

// POST /api/picking/doc-link — guardar link para un documento
export async function POST(request: NextRequest) {
  const { documento, drive_url } = await request.json()
  if (!documento || !drive_url) return NextResponse.json({ error: 'documento y drive_url requeridos' }, { status: 400 })
  const fileId = extractFileId(drive_url)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('picking_doc_links')
    .upsert({ documento: documento.trim(), drive_url: drive_url.trim(), drive_file_id: fileId, updated_at: new Date().toISOString() }, { onConflict: 'documento' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
