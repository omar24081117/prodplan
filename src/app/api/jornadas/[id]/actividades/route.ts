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

  // Enriquecer con estandar desde base_procesos para actividades sin estandar guardado
  const actividades = data ?? []
  const sinEstandar = actividades.filter(
    (a: Record<string, unknown>) => (a.estandar == null || a.estandar === 0) && a.sku && a.proceso
  )

  if (sinEstandar.length > 0) {
    // Obtener SKUs únicos que necesitan lookup
    const skus = [...new Set(sinEstandar.map((a: Record<string, unknown>) => a.sku as string))]
    const { data: catalogoItems } = await supabase
      .from('catalogo')
      .select('id, sku')
      .in('sku', skus)

    if (catalogoItems && catalogoItems.length > 0) {
      const skuToId = new Map(catalogoItems.map((c: { id: string; sku: string }) => [c.sku, c.id]))
      const catalogoIds = catalogoItems.map((c: { id: string }) => c.id)

      const { data: baseProcesos } = await supabase
        .from('base_procesos')
        .select('catalogo_id, proceso, estandar')
        .in('catalogo_id', catalogoIds)

      const bpMap = new Map(
        (baseProcesos ?? []).map((bp: { catalogo_id: string; proceso: string; estandar: number }) =>
          [`${bp.catalogo_id}||${bp.proceso}`, bp.estandar]
        )
      )

      // Asignar estandar a las actividades que no lo tienen
      for (const act of actividades as Record<string, unknown>[]) {
        if ((act.estandar == null || act.estandar === 0) && act.sku && act.proceso) {
          const catalogoId = skuToId.get(act.sku as string)
          if (catalogoId) {
            const estandar = bpMap.get(`${catalogoId}||${act.proceso}`)
            if (estandar) act.estandar = estandar
          }
        }
      }
    }
  }

  return NextResponse.json(actividades)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  // Intentar con campo unidad; si el schema no lo tiene, guardarlo en notas
  const { data, error } = await supabase
    .from('actividades')
    .insert({ ...body, jornada_id: id, origen: 'manual' })
    .select()
    .single()

  if (error) {
    // Si el error es por columnas desconocidas (unidad, estandar, etc.), reintentamos sin ellas
    if (error.message.includes('column') || error.message.includes('unidad') || error.message.includes('estandar')) {
      const { unidad, estandar, ...bodyRest } = body
      const notasConUnidad = unidad
        ? (bodyRest.notas ? `[${unidad}] ${bodyRest.notas}` : `[${unidad}]`)
        : bodyRest.notas
      const { data: data2, error: error2 } = await supabase
        .from('actividades')
        .insert({ ...bodyRest, notas: notasConUnidad || null, jornada_id: id, origen: 'manual' })
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

  const rows = actividades.map((a: Record<string, unknown>) => ({ ...a, jornada_id: id, origen: 'excel' }))

  const { data, error } = await supabase.from('actividades').insert(rows).select()

  if (error) {
    // Fallback sin columnas desconocidas (unidad, estandar)
    if (error.message.includes('column') || error.message.includes('unidad') || error.message.includes('estandar')) {
      const rowsFallback = actividades.map((a: Record<string, unknown>) => {
        const { unidad, estandar, ...rest } = a as { unidad?: string; estandar?: number; [k: string]: unknown }
        const notasConUnidad = unidad
          ? (rest.notas ? `[${unidad}] ${rest.notas}` : `[${unidad}]`)
          : rest.notas
        return { ...rest, notas: notasConUnidad || null, jornada_id: id, origen: 'excel' }
      })
      const { data: data2, error: error2 } = await supabase.from('actividades').insert(rowsFallback).select()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: data2?.length ?? 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, count: data?.length ?? 0 })
}
