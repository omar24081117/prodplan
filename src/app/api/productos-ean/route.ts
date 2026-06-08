import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/productos-ean?ean=7709... OR ?ref=10000 OR ?q=texto
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ean = searchParams.get('ean')
  const ref = searchParams.get('ref')
  const q   = searchParams.get('q')

  const supabase = await createClient()
  let query = supabase.from('productos_ean').select('referencia, descripcion, tipo, ean13').eq('activo', true)

  if (ean) query = query.eq('ean13', ean.trim())
  else if (ref) query = query.eq('referencia', ref.trim())
  else if (q) query = query.or(`referencia.ilike.%${q}%,descripcion.ilike.%${q}%,ean13.ilike.%${q}%`)

  const { data, error } = await query.limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
