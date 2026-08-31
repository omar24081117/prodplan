import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('solicitudes_mensajeria')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { solicitante_nombre, area, destinatario, direccion, descripcion, urgencia } = body

  if (!solicitante_nombre || !area || !destinatario || !direccion || !descripcion) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const { data, error } = await supabase
    .from('solicitudes_mensajeria')
    .insert({ fecha: hoy, solicitante_nombre, area, destinatario, direccion, descripcion, urgencia: urgencia ?? 'Normal', estado: 'Pendiente' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
