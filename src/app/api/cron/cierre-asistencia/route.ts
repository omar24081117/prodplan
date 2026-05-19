import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TZ = 'America/Bogota'

function getFechaLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Convierte "HH:MM" a minutos desde medianoche */
function toMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/**
 * Dado hora_ingreso (HH:MM), retorna la hora de salida por defecto según las reglas:
 * - Ingreso 05:30–07:30 → salida 17:00
 * - Ingreso 12:30–14:00 → salida 23:00
 * - Otro rango → null (no se cierra)
 */
function horaSalidaDefault(horaIngreso: string): string | null {
  const min = toMin(horaIngreso)
  if (min >= toMin('05:30') && min <= toMin('07:30')) return '17:00'
  if (min >= toMin('12:30') && min <= toMin('14:00')) return '23:00'
  return null
}

export async function GET(request: NextRequest) {
  // Seguridad: solo Vercel Cron puede llamar este endpoint
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const fecha = getFechaLocal()

  // Buscar registros sin hora_salida del día actual
  const { data: abiertos, error } = await supabase
    .from('asistencia')
    .select('id, cedula, nombre, hora_ingreso')
    .eq('fecha', fecha)
    .is('hora_salida', null)
    .not('hora_ingreso', 'is', null)

  if (error) {
    console.error('[cron/cierre-asistencia] Error al consultar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!abiertos || abiertos.length === 0) {
    return NextResponse.json({ ok: true, cerrados: 0, fecha, mensaje: 'Sin registros abiertos' })
  }

  const resultados: { cedula: string; nombre: string; hora_ingreso: string; hora_salida: string }[] = []
  const sinRegla: string[] = []

  for (const reg of abiertos) {
    const salida = horaSalidaDefault(reg.hora_ingreso)
    if (!salida) {
      sinRegla.push(`${reg.nombre} (ingreso ${reg.hora_ingreso})`)
      continue
    }

    const { error: updErr } = await supabase
      .from('asistencia')
      .update({ hora_salida: salida })
      .eq('id', reg.id)

    if (updErr) {
      console.error('[cron/cierre-asistencia] Error al actualizar:', reg.cedula, updErr)
    } else {
      resultados.push({
        cedula: reg.cedula,
        nombre: reg.nombre,
        hora_ingreso: reg.hora_ingreso,
        hora_salida: salida,
      })
    }
  }

  console.log(`[cron/cierre-asistencia] ${fecha}: cerrados=${resultados.length} sin_regla=${sinRegla.length}`)

  return NextResponse.json({
    ok: true,
    fecha,
    cerrados: resultados.length,
    detalle: resultados,
    sinRegla,
  })
}
