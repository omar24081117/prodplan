import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROLES_APROBADORES = ['Supervisor', 'Analista', 'Director']

export async function POST(request: NextRequest) {
  const { cedula_empleado, fecha, cedula_aprobador } = await request.json()

  if (!cedula_empleado || !fecha || !cedula_aprobador) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const supabase = await createClient()

  // Validar aprobador
  const { data: aprobador, error } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula_aprobador.trim())
    .eq('activo', true)
    .single()

  if (error || !aprobador) {
    return NextResponse.json({ error: 'Cédula del aprobador no encontrada o inactiva' }, { status: 401 })
  }

  const rol = aprobador.rol ?? 'Operario'
  if (!ROLES_APROBADORES.includes(rol)) {
    return NextResponse.json({
      error: `El rol "${rol}" no está autorizado para aprobar horas extra.`,
    }, { status: 403 })
  }

  // Guardar aprobación (upsert)
  const { error: saveErr } = await supabase
    .from('horas_extra_aprobaciones')
    .upsert({
      cedula: cedula_empleado,
      fecha,
      aprobado_por_cedula: aprobador.cedula,
      aprobado_por_nombre: aprobador.nombre,
      aprobado_en: new Date().toISOString(),
    }, { onConflict: 'cedula,fecha' })

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, aprobado_por: aprobador.nombre, rol })
}

export async function DELETE(request: NextRequest) {
  const { cedula_empleado, fecha } = await request.json()
  const supabase = await createClient()
  await supabase.from('horas_extra_aprobaciones')
    .delete()
    .eq('cedula', cedula_empleado)
    .eq('fecha', fecha)
  return NextResponse.json({ ok: true })
}
