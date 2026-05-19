import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catalogo')
    .select('sku, nombre')
    .order('sku', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE() {
  const supabase = await createClient()
  const { error } = await supabase.from('catalogo').delete().neq('sku', '')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('catalogo')
    .upsert(body, { onConflict: 'sku' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
