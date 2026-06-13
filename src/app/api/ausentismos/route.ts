import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/ausentismos?fecha=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')

  if (!fecha) {
    return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ausentismos')
    .select('*')
    .eq('fecha', fecha)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/ausentismos
// body: { cedula, nombre, fecha, tipo }
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cedula, nombre, fecha, tipo } = body

  if (!cedula || !nombre || !fecha || !tipo) {
    return NextResponse.json({ error: 'cedula, nombre, fecha y tipo son requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ausentismos')
    .upsert({ cedula, nombre, fecha, tipo }, { onConflict: 'cedula,fecha' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/ausentismos?cedula=X&fecha=YYYY-MM-DD
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cedula = searchParams.get('cedula')
  const fecha  = searchParams.get('fecha')

  if (!cedula || !fecha) {
    return NextResponse.json({ error: 'cedula y fecha requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ausentismos')
    .delete()
    .eq('cedula', cedula)
    .eq('fecha', fecha)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
