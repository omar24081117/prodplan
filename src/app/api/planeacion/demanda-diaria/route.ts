import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const supabase = await createClient()
  let q = supabase.from('plan_demanda_diaria').select('*')
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { referencia, fecha, pedido } = body
  if (!referencia || !fecha)
    return NextResponse.json({ error: 'referencia y fecha requeridos' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plan_demanda_diaria')
    .upsert(
      { referencia, fecha, pedido: Number(pedido) || 0, updated_at: new Date().toISOString() },
      { onConflict: 'referencia,fecha' }
    )
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
