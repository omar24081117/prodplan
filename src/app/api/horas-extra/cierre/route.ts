import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/horas-extra/cierre?fecha=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  if (!fecha) return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('horas_extra_cierres')
    .select('fecha, cerrado_por_cedula, cerrado_por_nombre, cerrado_en')
    .eq('fecha', fecha)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// POST /api/horas-extra/cierre — cerrar el día (Supervisor o superior)
export async function POST(request: NextRequest) {
  const { fecha, cedula } = await request.json()
  if (!fecha || !cedula) return NextResponse.json({ error: 'fecha y cedula requeridos' }, { status: 400 })

  const supabase = await createClient()

  const { data: persona, error: pErr } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (pErr || !persona) return NextResponse.json({ error: 'Cédula no encontrada o inactiva' }, { status: 401 })

  const ROLES_CIERRE = ['Supervisor', 'supervisor', 'Analista', 'Director']
  if (!ROLES_CIERRE.includes(persona.rol ?? '')) {
    return NextResponse.json({ error: `El rol "${persona.rol}" no está autorizado para cerrar el día` }, { status: 403 })
  }

  const { error } = await supabase
    .from('horas_extra_cierres')
    .upsert({ fecha, cerrado_por_cedula: persona.cedula, cerrado_por_nombre: persona.nombre, cerrado_en: new Date().toISOString() }, { onConflict: 'fecha' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cerrado_por: persona.nombre })
}

// DELETE /api/horas-extra/cierre — reabrir el día (solo Director)
export async function DELETE(request: NextRequest) {
  const { fecha, cedula } = await request.json()
  if (!fecha || !cedula) return NextResponse.json({ error: 'fecha y cedula requeridos' }, { status: 400 })

  const supabase = await createClient()

  const { data: persona, error: pErr } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (pErr || !persona) return NextResponse.json({ error: 'Cédula no encontrada o inactiva' }, { status: 401 })

  if (!['Director', 'director'].includes(persona.rol ?? '')) {
    return NextResponse.json({ error: 'Solo el Director puede reabrir un día cerrado' }, { status: 403 })
  }

  const { error } = await supabase.from('horas_extra_cierres').delete().eq('fecha', fecha)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, reabierto_por: persona.nombre })
}
