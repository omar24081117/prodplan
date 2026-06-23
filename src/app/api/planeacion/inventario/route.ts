import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventario_pt')
    .select('*')
    .order('referencia', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — bulk upsert desde Excel
export async function POST(request: NextRequest) {
  const body = await request.json()
  const rows: Array<{
    referencia: string
    descripcion?: string
    bodega?: string
    um?: string
    existencia?: number
    tipo?: string
    fecha_ultima?: string | null
    semana_actualizacion?: string | null
  }> = body

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin datos' }, { status: 400 })

  const supabase = await createClient()

  const buildRows = (includeSemana: boolean) => rows.map(r => ({
    referencia:   String(r.referencia),
    descripcion:  r.descripcion ?? null,
    bodega:       r.bodega      ?? null,
    um:           r.um          ?? 'UND',
    existencia:   Number(r.existencia) || 0,
    tipo:         r.tipo        ?? 'PT',
    fecha_ultima: r.fecha_ultima ?? null,
    updated_at:   new Date().toISOString(),
    ...(includeSemana ? { semana_actualizacion: r.semana_actualizacion ?? null } : {}),
  }))

  let { error } = await supabase
    .from('inventario_pt')
    .upsert(buildRows(true), { onConflict: 'referencia' })

  // If column doesn't exist yet (migration pending), retry without it
  if (error?.message?.includes('semana_actualizacion')) {
    const retry = await supabase
      .from('inventario_pt')
      .upsert(buildRows(false), { onConflict: 'referencia' })
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}

export async function DELETE() {
  const supabase = await createClient()
  const { error } = await supabase.from('inventario_pt').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
