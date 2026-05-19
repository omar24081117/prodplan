import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('actividad_operarios')
    .select('cedula, nombre')
    .eq('actividad_id', id)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { cedula, nombre } = await request.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from('actividad_operarios')
    .upsert({ actividad_id: id, cedula, nombre }, { onConflict: 'actividad_id,cedula' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { cedula } = await request.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from('actividad_operarios')
    .delete()
    .eq('actividad_id', id)
    .eq('cedula', cedula)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
