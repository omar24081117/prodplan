import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = createAdminClient()

  const { error: e1 } = await supabase.from('solicitudes_compras').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const { error: e2 } = await supabase.from('solicitudes_mensajeria').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
