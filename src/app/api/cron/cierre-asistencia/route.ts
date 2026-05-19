import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TZ = 'America/Bogota'

/** Suma horas a "HH:MM" y devuelve "HH:MM" (ajusta cruce de medianoche) */
function sumarHoras(hora: string, horas: number): string {
  const [h, m] = hora.split(':').map(Number)
  const totalMin = h * 60 + m + horas * 60
  const hh = Math.floor(totalMin / 60) % 24
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Devuelve true si ya pasaron 12 horas desde ingreso.
 * Tiene en cuenta el cruce de medianoche: si la hora de cierre
 * (ingreso + 12h) es menor a la hora de ingreso, significa que
 * el cierre cae al día siguiente.
 */
function ya12Horas(horaIngreso: string, horaActualMin: number): boolean {
  const [hi, mi] = horaIngreso.split(':').map(Number)
  const minIngreso = hi * 60 + mi
  const minCierre = minIngreso + 12 * 60 // puede superar 1440

  // horaActualMin puede estar en el mismo día o al día siguiente (+ 1440)
  // Comparamos directamente en minutos acumulados
  return horaActualMin >= minCierre
}

export async function GET(request: NextRequest) {
  // Seguridad: solo Vercel Cron puede llamar este endpoint
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const supabase = await createClient()

  // Hora actual en COT en minutos desde medianoche
  const horaActualStr = now.toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  const [ha, ma] = horaActualStr.split(':').map(Number)
  // Si son las 3am COT (el cron corre de madrugada), las entradas del día anterior
  // que cruzaron medianoche se representan como minutos > 1440
  const esManana = ha < 12 // corremos de madrugada
  const horaActualMin = esManana ? (ha + 24) * 60 + ma : ha * 60 + ma

  // Fechas a revisar: hoy y ayer en COT (para cubrir turnos que cruzan medianoche)
  const fechaHoy = now.toLocaleDateString('en-CA', { timeZone: TZ })
  const ayer = new Date(now)
  ayer.setDate(ayer.getDate() - 1)
  const fechaAyer = ayer.toLocaleDateString('en-CA', { timeZone: TZ })

  // Registros sin salida de hoy y ayer
  const { data: abiertos, error } = await supabase
    .from('asistencia')
    .select('id, cedula, nombre, hora_ingreso, fecha')
    .in('fecha', [fechaHoy, fechaAyer])
    .is('hora_salida', null)
    .not('hora_ingreso', 'is', null)

  if (error) {
    console.error('[cron/cierre-asistencia]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!abiertos || abiertos.length === 0) {
    return NextResponse.json({ ok: true, cerrados: 0, mensaje: 'Sin registros abiertos' })
  }

  const cerrados: { nombre: string; hora_ingreso: string; hora_salida: string; fecha: string }[] = []

  for (const reg of abiertos) {
    // Para registros de ayer, el horaActualMin ya tiene +24h si es de madrugada
    const minIngreso = (() => {
      const [h, m] = reg.hora_ingreso.split(':').map(Number)
      const base = h * 60 + m
      // Si el registro es de ayer y corremos de madrugada, ajustamos
      return reg.fecha === fechaAyer ? base : base
    })()
    const minCierre = minIngreso + 12 * 60

    const umbral = reg.fecha === fechaAyer
      ? (esManana ? horaActualMin : ha * 60 + ma + 24 * 60) // ayer + hoy madrugada
      : horaActualMin

    if (umbral < minCierre) continue // aún no han pasado 12h

    const horaSalida = sumarHoras(reg.hora_ingreso, 12)

    const { error: updErr } = await supabase
      .from('asistencia')
      .update({ hora_salida: horaSalida })
      .eq('id', reg.id)

    if (!updErr) {
      cerrados.push({ nombre: reg.nombre, hora_ingreso: reg.hora_ingreso, hora_salida: horaSalida, fecha: reg.fecha })
    }
  }

  console.log(`[cron/cierre-asistencia] cerrados=${cerrados.length}`)
  return NextResponse.json({ ok: true, cerrados: cerrados.length, detalle: cerrados })
}
