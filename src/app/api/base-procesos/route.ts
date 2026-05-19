import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/base-procesos?sku=X&proceso=Y  → lookup puntual
// GET /api/base-procesos?catalogo_id=X    → todos los procesos del producto
// GET /api/base-procesos                  → todos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sku = searchParams.get('sku')
  const proceso = searchParams.get('proceso')
  const catalogo_id = searchParams.get('catalogo_id')
  const supabase = await createClient()

  // Lookup por SKU + proceso (para planeación)
  if (sku && proceso) {
    const { data, error } = await supabase
      .from('base_procesos')
      .select('*, catalogo!inner(sku, nombre)')
      .eq('catalogo.sku', sku)
      .eq('proceso', proceso)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  let query = supabase
    .from('base_procesos')
    .select('*, catalogo(id, sku, nombre)')
    .order('proceso', { ascending: true })

  if (catalogo_id) query = query.eq('catalogo_id', catalogo_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('base_procesos')
    .upsert(body, { onConflict: 'catalogo_id,proceso' })
    .select('*, catalogo(id, sku, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
