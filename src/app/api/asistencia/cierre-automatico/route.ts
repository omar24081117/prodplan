import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TZ = 'America/Bogota'

function sumarHoras(hora: string, horas: number): string {
  const [h, m] = hora.split(':').map(Number)
  const totalMin = h * 60 + m + horas * 60
  const hh = Math.floor(totalMin / 60) % 24
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function getMinutosActuales(): number {
  const horaStr = new Date().toLocaleTimeString('es-CO', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const [h, m] = horaStr.split(':').map(Number)
  // Si es de madrugada (< 12), se asume que cruzamos medianoche
  return h < 12 ? (h + 24) * 60 + m : h * 60 + m
}

// POST: cierre manual desde el panel admin
export async function POST(request: NextRequest) {
  const { fecha } = await request.json()

  if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

  const supabase = await createClient()
  const minutosActuales = getMinutosActuales()

  const { data: abiertos, error } = await supabase
    .from('asistencia')
    .select('id, cedula, nombre, hora_ingreso')
    .eq('fecha', fecha)
    .is('hora_salida', null)
    .not('hora_ingreso', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!abiertos || abiertos.length === 0) {
    return NextResponse.json({ ok: true, cerrados: 0, mensaje: 'Sin registros abiertos' })
  }

  const cerrados: { nombre: string; hora_ingreso: string; hora_salida: string }[] = []
  const pendientes: { nombre: string; hora_ingreso: string; faltanMin: number }[] = []

  for (const reg of abiertos) {
    const [hi, mi] = reg.hora_ingreso.split(':').map(Number)
    const minIngreso = hi * 60 + mi
    const minCierre = minIngreso + 12 * 60

    if (minutosActuales < minCierre) {
      pendientes.push({
        nombre: reg.nombre,
        hora_ingreso: reg.hora_ingreso,
        faltanMin: minCierre - minutosActuales,
      })
      continue
    }

    const horaSalida = sumarHoras(reg.hora_ingreso, 12)

    const { error: updErr } = await supabase
      .from('asistencia')
      .update({ hora_salida: horaSalida })
      .eq('id', reg.id)

    if (!updErr) cerrados.push({ nombre: reg.nombre, hora_ingreso: reg.hora_ingreso, hora_salida: horaSalida })
  }

  return NextResponse.json({
    ok: true,
    cerrados: cerrados.length,
    detalle: cerrados,
    pendientes,
  })
}
