import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('actividades')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // If 'unidad' column doesn't exist, retry storing it as [UND] prefix in notas
    if (error.message.includes('unidad') || error.code === 'PGRST204') {
      const { unidad, ...bodyRest } = body
      const notasConUnidad = unidad
        ? (bodyRest.notas ? `[${unidad}] ${bodyRest.notas}` : `[${unidad}]`)
        : bodyRest.notas
      const { data: data2, error: error2 } = await supabase
        .from('actividades')
        .update({ ...bodyRest, notas: notasConUnidad })
        .eq('id', id)
        .select()
        .single()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 })
      return NextResponse.json(data2)
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('actividades').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
