import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/picking?despacho_id=X
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const despacho_id = searchParams.get('despacho_id')
  if (!despacho_id) return NextResponse.json({ error: 'despacho_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('picking_registros')
    .select('*')
    .eq('despacho_id', despacho_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/picking — agregar ítem escaneado
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { despacho_id, documento, referencia, ean13, descripcion, cantidad, usuario_cedula, usuario_nombre } = body
  if (!despacho_id) return NextResponse.json({ error: 'despacho_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('picking_registros')
    .insert({
      despacho_id, documento,
      referencia: referencia ?? null,
      ean13: ean13 ?? null,
      descripcion: descripcion ?? null,
      cantidad: cantidad ?? 1,
      usuario_cedula: usuario_cedula ?? null,
      usuario_nombre: usuario_nombre ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/picking?id=X — quitar ítem
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('picking_registros').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
