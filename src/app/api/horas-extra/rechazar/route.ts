import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROLES_APROBADORES = ['Supervisor', 'supervisor', 'Analista', 'Director']

export async function POST(request: NextRequest) {
  const { cedula_empleado, fecha, cedula_aprobador } = await request.json()

  if (!cedula_empleado || !fecha || !cedula_aprobador) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: aprobador, error } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula_aprobador.trim())
    .eq('activo', true)
    .single()

  if (error || !aprobador) {
    return NextResponse.json({ error: 'Cédula no encontrada o inactiva' }, { status: 401 })
  }

  const rol = aprobador.rol ?? 'Operario'
  if (!ROLES_APROBADORES.includes(rol)) {
    return NextResponse.json({
      error: `El rol "${rol}" no está autorizado para rechazar horas extra.`,
    }, { status: 403 })
  }

  const { error: saveErr } = await supabase
    .from('horas_extra_aprobaciones')
    .upsert({
      cedula: cedula_empleado,
      fecha,
      aprobado_por_cedula: aprobador.cedula,
      aprobado_por_nombre: aprobador.nombre,
      aprobado_en: new Date().toISOString(),
      rechazado: true,
      rechazado_por_cedula: aprobador.cedula,
      rechazado_por_nombre: aprobador.nombre,
      rechazado_en: new Date().toISOString(),
    }, { onConflict: 'cedula,fecha' })

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, rechazado_por: aprobador.nombre, rol })
}
