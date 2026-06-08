import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/picking/ean-mapping?ean=XXXX
export async function GET(request: NextRequest) {
  const ean = new URL(request.url).searchParams.get('ean')
  if (!ean) return NextResponse.json(null)
  const supabase = await createClient()
  const { data } = await supabase.from('ean_mapping').select('referencia, descripcion').eq('ean_fisico', ean).single()
  return NextResponse.json(data)
}

// POST /api/picking/ean-mapping — guardar mapeo EAN físico → referencia
export async function POST(request: NextRequest) {
  const { ean_fisico, referencia, descripcion } = await request.json()
  if (!ean_fisico || !referencia) return NextResponse.json({ error: 'ean_fisico y referencia requeridos' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ean_mapping')
    .upsert({ ean_fisico, referencia, descripcion: descripcion ?? null }, { onConflict: 'ean_fisico' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
