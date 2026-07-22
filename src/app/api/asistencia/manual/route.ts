import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/asistencia/manual
// Inserción manual de asistencia por un director/admin para cualquier persona y fecha
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cedula, fecha, hora_ingreso, hora_salida } = body

  if (!cedula || !fecha || !hora_ingreso) {
    return NextResponse.json({ error: 'cedula, fecha y hora_ingreso son requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verificar que la persona existe
  const { data: persona, error: personaError } = await supabase
    .from('personal')
    .select('cedula, nombre, rol')
    .eq('cedula', cedula.trim())
    .single()

  if (personaError || !persona) {
    return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
  }

  // Determinar turno desde hora_ingreso
  const [h] = hora_ingreso.split(':').map(Number)
  let turno = 'MAÑANA'
  if (h >= 14 && h < 22) turno = 'TARDE'
  else if (h >= 22 || h < 5) turno = 'NOCHE'

  // Upsert: si ya existe para esa cédula+fecha, actualizar; si no, insertar
  const { data, error } = await supabase
    .from('asistencia')
    .upsert({
      cedula:       persona.cedula,
      nombre:       persona.nombre,
      fecha,
      turno,
      hora_ingreso,
      hora_salida:  hora_salida || null,
    }, { onConflict: 'cedula,fecha' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, registro: data })
}
