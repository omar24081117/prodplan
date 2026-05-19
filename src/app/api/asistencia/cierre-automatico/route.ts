import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TZ = 'America/Bogota'

function getFechaLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

function toMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function horaSalidaDefault(horaIngreso: string): string | null {
  const min = toMin(horaIngreso)
  if (min >= toMin('05:30') && min <= toMin('07:30')) return '17:00'
  if (min >= toMin('12:30') && min <= toMin('14:00')) return '23:00'
  return null
}

// POST: llamado manualmente desde el panel admin
export async function POST(request: NextRequest) {
  const { fecha } = await request.json()
  const fechaTarget = fecha || getFechaLocal()

  const supabase = await createClient()

  const { data: abiertos, error } = await supabase
    .from('asistencia')
    .select('id, cedula, nombre, hora_ingreso')
    .eq('fecha', fechaTarget)
    .is('hora_salida', null)
    .not('hora_ingreso', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!abiertos || abiertos.length === 0) {
    return NextResponse.json({ ok: true, cerrados: 0, mensaje: 'Sin registros abiertos' })
  }

  const cerrados: { nombre: string; hora_ingreso: string; hora_salida: string }[] = []
  const sinRegla: string[] = []

  for (const reg of abiertos) {
    const salida = horaSalidaDefault(reg.hora_ingreso)
    if (!salida) { sinRegla.push(reg.nombre); continue }

    const { error: updErr } = await supabase
      .from('asistencia')
      .update({ hora_salida: salida })
      .eq('id', reg.id)

    if (!updErr) cerrados.push({ nombre: reg.nombre, hora_ingreso: reg.hora_ingreso, hora_salida: salida })
  }

  return NextResponse.json({ ok: true, cerrados: cerrados.length, detalle: cerrados, sinRegla })
}
