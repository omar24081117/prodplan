import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// A partir del 2026-07-27, todos los lunes son día libre para Operarios y Temporales
const LUNES_LIBRE_DESDE = '2026-07-27'
function esLunesLibre(fecha: string): boolean {
  if (fecha < LUNES_LIBRE_DESDE) return false
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(y, mo - 1, d).getDay() === 1
}

export type RegistroHE = {
  cedula: string
  nombre: string
  rol: string | null
  hora_ingreso: string | null
  hora_salida: string | null
  turno: 'T1' | 'T2' | null
  entrada_norm: string | null
  salida_norm: string | null
  salida_efectiva: string | null
  minutos_extra: number
  horas_extra: number
  horas_recargo: number
  dia_libre: boolean
  aprobado: boolean
  aprobado_por_nombre: string | null
  aprobado_en: string | null
  rechazado: boolean
  rechazado_por_nombre: string | null
  rechazado_en: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') ??
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const supabase = await createClient()

  // Roles que participan en horas extra
  const ROLES_VALIDOS = ['Operario', 'Supervisor']

  // Mapa de rol y tipo_contrato por cédula (solo roles válidos)
  const { data: personal } = await supabase
    .from('personal')
    .select('cedula, rol, tipo_contrato')
    .in('rol', ROLES_VALIDOS)
    .eq('activo', true)

  const rolMap: Record<string, string> = {}
  const contratoMap: Record<string, string> = {}
  const cedulasValidas = new Set<string>()
  for (const p of personal ?? []) {
    rolMap[p.cedula] = p.rol
    contratoMap[p.cedula] = p.tipo_contrato ?? ''
    cedulasValidas.add(p.cedula)
  }

  const { data: asistencias, error } = await supabase
    .from('asistencia')
    .select('cedula, nombre, hora_ingreso, hora_salida')
    .eq('fecha', fecha)
    .not('hora_ingreso', 'is', null)
    .in('cedula', [...cedulasValidas])
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: aprobaciones } = await supabase
    .from('horas_extra_aprobaciones')
    .select('cedula, aprobado_por_nombre, aprobado_en, rechazado, rechazado_por_nombre, rechazado_en')
    .eq('fecha', fecha)

  type AproRow = {
    nombre: string; en: string
    rechazado: boolean; rechNombre: string | null; rechEn: string | null
  }
  const aproMap: Record<string, AproRow> = {}
  for (const a of aprobaciones ?? []) {
    aproMap[a.cedula] = {
      nombre: a.aprobado_por_nombre,
      en: a.aprobado_en,
      rechazado: !!a.rechazado,
      rechNombre: a.rechazado_por_nombre ?? null,
      rechEn: a.rechazado_en ?? null,
    }
  }

  const lunesLibreHoy = esLunesLibre(fecha)

  const registros: RegistroHE[] = (asistencias ?? []).map(a => {
    const inMins = toMins(a.hora_ingreso ?? '')
    let turno: 'T1' | 'T2' | null = null
    let entradaNorm: string | null = null
    let salidaNorm: string | null = null
    let salidaNormMins = -1

    // T1: entrada 5:00-7:30 (300-450 min)
    if (inMins >= 300 && inMins <= 450) {
      turno = 'T1'; entradaNorm = '06:00'; salidaNorm = '15:30'; salidaNormMins = 15*60+30
    }
    // T2: entrada 12:00-15:00 (720-900 min)
    else if (inMins >= 720 && inMins <= 900) {
      turno = 'T2'; entradaNorm = '13:00'; salidaNorm = '22:30'; salidaNormMins = 22*60+30
    }

    // ¿Aplica regla lunes libre? (Operario o Temporal desde 2026-07-27)
    const esOpTemporal = rolMap[a.cedula] === 'Operario' || contratoMap[a.cedula] === 'Temporal'
    const diaLibre = lunesLibreHoy && esOpTemporal

    let salidaEfectiva: string | null = null
    let minutosExtra = 0, horasExtra = 0, horasRecargo = 0

    if (diaLibre) {
      // Día libre: todas las horas trabajadas son extras, sin normalizar margen
      salidaEfectiva = a.hora_salida ?? null
      if (salidaEfectiva && inMins >= 0) {
        const outMins = toMins(salidaEfectiva)
        minutosExtra = Math.max(0, outMins - inMins)
        horasExtra = Math.round((minutosExtra / 60) * 100) / 100
        if (outMins >= 22*60+30) {
          horasRecargo = Math.round((Math.max(0, outMins - 19*60) / 60) * 100) / 100
        }
      }
    } else {
      // Salida efectiva: normalizar dentro del margen del turno, sino dejar real
      if (a.hora_salida && turno) {
        const outMins = toMins(a.hora_salida)
        if (turno === 'T1') {
          salidaEfectiva = (outMins >= 900 && outMins <= 950) ? '15:30' : a.hora_salida
        } else if (turno === 'T2') {
          salidaEfectiva = (outMins >= 1335 && outMins <= 1370) ? '22:30' : a.hora_salida
        }
      }

      // Extra: calculado sobre salida efectiva vs salida norm del turno
      if (salidaEfectiva && salidaNormMins > 0) {
        const efMins = toMins(salidaEfectiva)
        const extraMins = Math.max(0, efMins - salidaNormMins)
        minutosExtra = extraMins
        horasExtra = Math.round((extraMins / 60) * 100) / 100
        if (efMins >= 22*60+30) {
          horasRecargo = Math.round((Math.max(0, efMins - 19*60) / 60) * 100) / 100
        }
      }
    }

    const apro = aproMap[a.cedula]
    const esAprobado = !!apro && !apro.rechazado
    const esRechazado = !!apro && apro.rechazado

    return {
      cedula: a.cedula,
      nombre: a.nombre,
      rol: rolMap[a.cedula] ?? null,
      hora_ingreso: a.hora_ingreso,
      hora_salida: a.hora_salida,
      turno,
      entrada_norm: diaLibre ? null : entradaNorm,
      salida_norm: diaLibre ? null : salidaNorm,
      salida_efectiva: salidaEfectiva,
      minutos_extra: minutosExtra,
      horas_extra: horasExtra,
      horas_recargo: horasRecargo,
      dia_libre: diaLibre,
      aprobado: esAprobado,
      aprobado_por_nombre: esAprobado ? (apro?.nombre ?? null) : null,
      aprobado_en: esAprobado ? (apro?.en ?? null) : null,
      rechazado: esRechazado,
      rechazado_por_nombre: esRechazado ? (apro?.rechNombre ?? null) : null,
      rechazado_en: esRechazado ? (apro?.rechEn ?? null) : null,
    }
  })

  return NextResponse.json({ fecha, registros })
}
