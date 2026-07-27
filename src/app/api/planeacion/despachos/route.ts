import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/planeacion/despachos?semana=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const semana = searchParams.get('semana')

  const supabase = await createClient()
  let query = supabase
    .from('despachos_almacen')
    .select('id, referencia, descripcion, cantidad, fecha, semana_inicio, creado_en')
    .order('creado_en', { ascending: false })

  if (semana) query = query.eq('semana_inicio', semana)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/planeacion/despachos
// Guarda el despacho y acumula al inventario si la semana_actualizacion coincide
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { referencia, descripcion, cantidad, fecha, semana_inicio } = body

  if (!referencia || !cantidad || !semana_inicio) {
    return NextResponse.json({ error: 'referencia, cantidad y semana_inicio requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Insertar registro de despacho
  const { data: despacho, error: despErr } = await supabase
    .from('despachos_almacen')
    .insert({
      referencia,
      descripcion: descripcion ?? null,
      cantidad: Number(cantidad),
      fecha: fecha ?? semana_inicio,
      semana_inicio,
    })
    .select()
    .single()

  if (despErr) return NextResponse.json({ error: despErr.message }, { status: 500 })

  // 2. Sumar al inventario solo si semana_actualizacion === semana_inicio
  const { error: invErr } = await supabase.rpc('incrementar_inventario', {
    p_referencia: referencia,
    p_semana: semana_inicio,
    p_cantidad: Number(cantidad),
  })

  // Si el RPC no existe todavía, intentar con update directo
  if (invErr) {
    const { data: inv } = await supabase
      .from('inventario_pt')
      .select('existencia, semana_actualizacion')
      .eq('referencia', referencia)
      .single()

    if (inv && inv.semana_actualizacion === semana_inicio) {
      await supabase
        .from('inventario_pt')
        .update({ existencia: (inv.existencia ?? 0) + Number(cantidad) })
        .eq('referencia', referencia)
    }
  }

  return NextResponse.json(despacho)
}
