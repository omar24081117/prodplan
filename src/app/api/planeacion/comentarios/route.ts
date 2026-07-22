import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/planeacion/comentarios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = await createClient()
  let q = supabase.from('plan_comentarios').select('*')
  if (desde) q = q.gte('semana_inicio', desde)
  if (hasta) q = q.lte('semana_inicio', hasta)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — upsert { referencia, semana_inicio, texto, autor? }
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { referencia, semana_inicio, texto, autor } = body

  if (!referencia || !semana_inicio)
    return NextResponse.json({ error: 'referencia y semana_inicio son requeridos' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('plan_comentarios')
    .upsert(
      { referencia, semana_inicio, texto: texto ?? '', autor: autor ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'referencia,semana_inicio' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/planeacion/comentarios?referencia=...&semana_inicio=...
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const referencia    = searchParams.get('referencia')
  const semana_inicio = searchParams.get('semana_inicio')

  if (!referencia || !semana_inicio)
    return NextResponse.json({ error: 'referencia y semana_inicio son requeridos' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('plan_comentarios')
    .delete()
    .eq('referencia', referencia)
    .eq('semana_inicio', semana_inicio)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
