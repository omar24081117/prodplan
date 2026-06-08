import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria')
  const soloActivos = searchParams.get('activos') !== 'false'

  const supabase = await createClient()
  let q = supabase
    .from('almacen_productos')
    .select('*')
    .order('categoria')
    .order('nombre')

  if (soloActivos) q = q.eq('activo', true)
  if (categoria) q = q.eq('categoria', categoria)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const { id, ...campos } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('almacen_productos')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
