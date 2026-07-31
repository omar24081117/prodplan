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

// DELETE /api/planeacion/despachos?id=UUID
// Elimina el registro y revierte el ajuste de inventario si aplica
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await createClient()

  // 1. Leer el registro antes de borrar para conocer referencia, cantidad, semana
  const { data: d, error: getErr } = await supabase
    .from('despachos_almacen')
    .select('referencia, cantidad, semana_inicio')
    .eq('id', id)
    .single()

  if (getErr || !d) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

  // 2. Eliminar el registro
  const { error: delErr } = await supabase
    .from('despachos_almacen')
    .delete()
    .eq('id', id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // 3. Revertir el ajuste de inventario si semana_actualizacion === semana_inicio
  const { data: inv } = await supabase
    .from('inventario_pt')
    .select('existencia, semana_actualizacion')
    .eq('referencia', d.referencia)
    .single()

  if (inv && inv.semana_actualizacion === d.semana_inicio) {
    await supabase
      .from('inventario_pt')
      .update({ existencia: Math.max(0, (inv.existencia ?? 0) - Number(d.cantidad)) })
      .eq('referencia', d.referencia)
  }

  return NextResponse.json({ ok: true })
}
