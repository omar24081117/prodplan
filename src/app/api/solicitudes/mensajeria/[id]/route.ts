import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { estado, observacion, gestionado_por } = await req.json()

  if (!estado || !gestionado_por) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('solicitudes_mensajeria')
    .update({ estado, observacion: observacion || null, gestionado_por, gestionado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
