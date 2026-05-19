import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('causales_paro')
    .select('id, nombre, activo, orden')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { nombre } = await request.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  // Max orden actual
  const { data: maxRow } = await supabase
    .from('causales_paro')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()
  const orden = (maxRow?.orden ?? -1) + 1

  const { data, error } = await supabase
    .from('causales_paro')
    .insert({ nombre: nombre.trim().toUpperCase(), orden })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
