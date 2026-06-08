import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  const supabase = await createClient()

  // Total
  const { count } = await supabase
    .from('productos_ean')
    .select('*', { count: 'exact', head: true })

  let query = supabase
    .from('productos_ean')
    .select('referencia, descripcion, tipo, ean13, activo')
    .order('referencia', { ascending: true })
    .limit(500)

  if (q) {
    query = query.or(`referencia.ilike.%${q}%,descripcion.ilike.%${q}%,ean13.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [], total: count ?? 0 })
}
