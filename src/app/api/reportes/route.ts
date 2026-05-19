import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const actividad_id = searchParams.get('actividad_id')
  const supabase = await createClient()

  let query = supabase.from('reportes').select('*').order('hora', { ascending: true })
  if (actividad_id) query = query.eq('actividad_id', actividad_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reportes')
    .upsert(body, { onConflict: 'actividad_id,hora' })
    .select()
    .single()

  if (error) {
    // Si la columna no existe aún en Supabase, reintentar sin los campos opcionales
    const isMissingCol =
      error.message.includes('tiempo_improductivo') ||
      error.message.includes('observacion') ||
      error.message.includes('column') ||
      error.message.includes('does not exist')

    if (isMissingCol) {
      const { tiempo_improductivo, observacion, ...bodyBase } = body
      const { data: data2, error: error2 } = await supabase
        .from('reportes')
        .upsert(bodyBase, { onConflict: 'actividad_id,hora' })
        .select()
        .single()
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 })
      return NextResponse.json(data2, { status: 201 })
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
