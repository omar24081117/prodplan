import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const PAGE = 1000
  let all: unknown[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('despachos')
      .select('*')
      .order('fecha_max_entrega', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return NextResponse.json(all)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()
  if (Array.isArray(body)) {
    const { data, error } = await supabase.from('despachos').insert(body).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }
  const { data, error } = await supabase.from('despachos').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
