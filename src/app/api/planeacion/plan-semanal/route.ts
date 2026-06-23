import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/planeacion/plan-semanal?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = await createClient()
  let q = supabase.from('plan_semanal').select('*')
  if (desde) q = q.gte('semana_inicio', desde)
  if (hasta) q = q.lte('semana_inicio', hasta)
  q = q.order('semana_inicio', { ascending: true })

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — upsert one entry { referencia, semana_inicio, pedido, produccion }
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { referencia, semana_inicio, pedido, produccion } = body

  if (!referencia || !semana_inicio)
    return NextResponse.json({ error: 'referencia y semana_inicio son requeridos' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plan_semanal')
    .upsert(
      {
        referencia,
        semana_inicio,
        pedido:     pedido     ?? 0,
        produccion: produccion ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'referencia,semana_inicio' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — bulk upsert: [{ referencia, semana_inicio, pedido, produccion? }]
// Only updates the pedido field; preserves existing produccion if not provided.
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  if (!Array.isArray(body) || body.length === 0)
    return NextResponse.json({ error: 'Se esperaba un arreglo de entradas' }, { status: 400 })

  const supabase = await createClient()

  // First fetch existing entries to preserve produccion
  const refs   = [...new Set(body.map((r: { referencia: string }) => r.referencia))]
  const sems   = [...new Set(body.map((r: { semana_inicio: string }) => r.semana_inicio))]
  const { data: existing } = await supabase
    .from('plan_semanal')
    .select('referencia,semana_inicio,produccion')
    .in('referencia', refs)
    .in('semana_inicio', sems)

  const existMap: Record<string, number> = {}
  for (const e of existing ?? []) {
    existMap[`${e.referencia}_${e.semana_inicio}`] = e.produccion ?? 0
  }

  const rows = body.map((r: { referencia: string; semana_inicio: string; pedido: number; produccion?: number }) => ({
    referencia:    r.referencia,
    semana_inicio: r.semana_inicio,
    pedido:        r.pedido ?? 0,
    produccion:    r.produccion ?? existMap[`${r.referencia}_${r.semana_inicio}`] ?? 0,
    updated_at:    new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('plan_semanal')
    .upsert(rows, { onConflict: 'referencia,semana_inicio' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
