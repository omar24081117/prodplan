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

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
