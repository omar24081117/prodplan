import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('actividades')
    .select('*')
    .eq('jornada_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  // Intentar con campo unidad; si el schema no lo tiene, guardarlo en notas
  const { data, error } = await supabase
    .from('actividades')
    .insert({ ...body, jornada_id: id })
    .select()
    .single()

  if (error) {
    // Si el error es por columna unidad desconocida, reintentamos sin ella
    if (error.message.includes('unidad') || error.code === 'PGRST204') {
      const { unidad, ...bodyRest } = body
      const notasConUnidad = unidad
        ? (bodyRest.notas ? `[${unidad}] ${bodyRest.notas}` : `[${unidad}]`)
        : bodyRest.notas
      const { data: data2, error: error2 } = await supabase
        .from('actividades')
        .insert({ ...bodyRest, notas: notasConUnidad || null, jornada_id: id })
        .select()
        .single()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 })
      return NextResponse.json(data2, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}

// Bulk insert: acepta array de actividades
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { actividades } = await request.json()
  if (!Array.isArray(actividades) || actividades.length === 0) {
    return NextResponse.json({ error: 'Se requiere un array de actividades' }, { status: 400 })
  }
  const supabase = await createClient()

  const rows = actividades.map((a: Record<string, unknown>) => ({ ...a, jornada_id: id }))

  const { data, error } = await supabase.from('actividades').insert(rows).select()

  if (error) {
    // Fallback sin campo unidad
    if (error.message.includes('unidad') || error.code === 'PGRST204') {
      const rowsFallback = actividades.map((a: Record<string, unknown>) => {
        const { unidad, ...rest } = a as { unidad?: string; [k: string]: unknown }
        const notasConUnidad = unidad
          ? (rest.notas ? `[${unidad}] ${rest.notas}` : `[${unidad}]`)
          : rest.notas
        return { ...rest, notas: notasConUnidad || null, jornada_id: id }
      })
      const { data: data2, error: error2 } = await supabase.from('actividades').insert(rowsFallback).select()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: data2?.length ?? 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, count: data?.length ?? 0 })
}
