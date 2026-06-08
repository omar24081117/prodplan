import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('personal')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map(p => ({
    ...p,
    rol: p.rol ?? 'Operario',
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()

  if (Array.isArray(body)) {
    const rows = body.map(r => ({ rol: 'Operario', ...r }))
    const { data, error } = await supabase
      .from('personal')
      .upsert(rows, { onConflict: 'cedula' })
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }

  const payload = { rol: 'Operario', ...body }
  const { data, error } = await supabase
    .from('personal')
    .insert(payload)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
