import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  // Traer asistencias de hoy con hora de entrada, sin salida aún
  const { data: asistencias } = await supabase
    .from('asistencia')
    .select('cedula')
    .eq('fecha', fecha)
    .not('hora_ingreso', 'is', null)
    .is('hora_salida', null)

  if (!asistencias || asistencias.length === 0) {
    return NextResponse.json({ total: 0, operarios: 0, otros: 0 })
  }

  const cedulas = asistencias.map(a => a.cedula)

  // Consultar roles de esas cédulas en personal
  const { data: personal } = await supabase
    .from('personal')
    .select('cedula, rol')
    .in('cedula', cedulas)

  const rolMap: Record<string, string> = {}
  for (const p of personal ?? []) {
    rolMap[p.cedula] = p.rol ?? 'Operario'
  }

  let operarios = 0
  let otros = 0
  for (const a of asistencias) {
    const rol = rolMap[a.cedula] ?? 'Operario'
    if (rol === 'Operario') operarios++
    else otros++
  }

  return NextResponse.json({
    total: asistencias.length,
    operarios,
    otros,
  })
}
