import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { estado, observacion, gestionado_por, mensajero_asignado } = await req.json()

  if (!estado || !gestionado_por) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const updatePayload: Record<string, string | null> = {
    estado, observacion: observacion || null, gestionado_por, gestionado_en: new Date().toISOString(),
  }
  if (mensajero_asignado !== undefined) updatePayload.mensajero_asignado = mensajero_asignado || null

  const { data, error } = await supabase
    .from('solicitudes_mensajeria')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
