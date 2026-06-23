import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plan_actividades_base')
    .select('*')
    .order('referencia', { ascending: true })
    .order('orden', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — bulk upsert desde Excel
export async function POST(request: NextRequest) {
  const body = await request.json()
  const rows: Array<{
    referencia: string
    descripcion_producto?: string
    actividad: string
    sub_referencia?: string | null
    orden?: number
  }> = body

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin datos' }, { status: 400 })

  const supabase = await createClient()

  // Delete existing for these references, then insert fresh
  const refs = [...new Set(rows.map(r => r.referencia))]
  await supabase.from('plan_actividades_base').delete().in('referencia', refs)

  const { error } = await supabase.from('plan_actividades_base').insert(
    rows.map((r, i) => ({
      referencia:           String(r.referencia),
      descripcion_producto: r.descripcion_producto ?? null,
      actividad:            r.actividad,
      sub_referencia:       r.sub_referencia ?? null,
      orden:                r.orden ?? i,
    }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}

export async function DELETE() {
  const supabase = await createClient()
  const { error } = await supabase.from('plan_actividades_base').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
