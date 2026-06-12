import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cedula = searchParams.get('cedula')
  const mes    = searchParams.get('mes')

  if (!cedula) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 })

  const supabase = await createClient()

  const { data: empleado, error: empError } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (empError || !empleado) return NextResponse.json({ error: 'Cédula no encontrada o empleado inactivo' }, { status: 404 })
  if (!['Operario', 'Supervisor', 'supervisor'].includes(empleado.rol)) return NextResponse.json({ error: 'Solo operarios y supervisores pueden consultar este reporte' }, { status: 403 })

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const fechaInicio = searchParams.get('fecha_inicio') ?? (mes ? `${mes}-01` : hoy.slice(0, 7) + '-01')
  const fechaFinParam = searchParams.get('fecha_fin')
  let fechaFin: string
  if (fechaFinParam) {
    fechaFin = fechaFinParam
  } else if (mes) {
    const nextMonth = new Date(mes + '-01')
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(0)
    fechaFin = nextMonth.toLocaleDateString('en-CA')
  } else {
    fechaFin = hoy
  }

  // Asistencia del rango
  const { data: asistencias } = await supabase
    .from('asistencia')
    .select('fecha, hora_ingreso, hora_salida')
    .eq('cedula', empleado.cedula)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: false })

  // Aprobaciones del rango
  const { data: aprobaciones } = await supabase
    .from('horas_extra_aprobaciones')
    .select('fecha, aprobado_por_nombre, rechazado, rechazado_por_nombre')
    .eq('cedula', empleado.cedula)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  // Overrides del admin (correcciones manuales y jornadas adicionales)
  const { data: overrides } = await supabase
    .from('horas_extra_overrides')
    .select('fecha, hora_ingreso, salida_efectiva, horas_extra_manual')
    .eq('cedula', empleado.cedula)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const aproMap: Record<string, { aprobado_por_nombre: string; rechazado: boolean }> = {}
  for (const a of aprobaciones ?? []) {
    aproMap[a.fecha] = { aprobado_por_nombre: a.aprobado_por_nombre, rechazado: !!a.rechazado }
  }

  // Mapa de overrides por fecha
  const ovMap: Record<string, { hora_ingreso: string | null; salida_efectiva: string | null; horas_extra_manual: number | null }> = {}
  for (const ov of overrides ?? []) {
    ovMap[ov.fecha] = {
      hora_ingreso:       ov.hora_ingreso ?? null,
      salida_efectiva:    ov.salida_efectiva ?? null,
      horas_extra_manual: typeof ov.horas_extra_manual === 'number' ? ov.horas_extra_manual : null,
    }
  }

  // Fechas aprobadas sin asistencia registrada
  const fechasAsistencia = new Set((asistencias ?? []).map(a => a.fecha))
  const fechasAprobadas  = Object.keys(aproMap).filter(f => !fechasAsistencia.has(f))

  // ── Construir registros desde asistencia (lógica original + overrides) ────
  const registrosAsistencia = (asistencias ?? [])
    .filter(a => a.hora_ingreso != null)
    .map(a => {
      const ov   = ovMap[a.fecha]
      const apro = aproMap[a.fecha]
      const esAprobado  = !!apro && !apro.rechazado
      const esRechazado = !!apro && apro.rechazado

      // Override: jornada adicional (horas extra ingresadas manualmente)
      if (ov?.horas_extra_manual && ov.horas_extra_manual > 0) {
        return {
          fecha:                a.fecha,
          turno:                null as 'T1' | 'T2' | null,
          hora_ingreso:         ov.hora_ingreso ?? a.hora_ingreso,
          hora_salida:          a.hora_salida,
          salida_norm:          null as string | null,
          salida_efectiva:      null as string | null,
          minutos_extra:        Math.round(ov.horas_extra_manual * 60),
          horas_extra:          ov.horas_extra_manual,
          horas_recargo:        0,
          aprobado:             esAprobado,
          rechazado:            esRechazado,
          aprobado_por_nombre:  esAprobado ? (apro?.aprobado_por_nombre ?? null) : null,
          es_jornada_adicional: true,
        }
      }

      // Cálculo normal — usar override de hora_ingreso/salida_efectiva si existe
      const horaIngresoEfec = ov?.hora_ingreso    || a.hora_ingreso
      const inMins = toMins(horaIngresoEfec ?? '')
      let turno: 'T1' | 'T2' | null = null
      let salidaNorm: string | null = null
      let salidaNormMins = -1

      if (inMins >= 300 && inMins <= 450)  { turno = 'T1'; salidaNorm = '15:30'; salidaNormMins = 15*60+30 }
      else if (inMins >= 720 && inMins <= 900) { turno = 'T2'; salidaNorm = '22:30'; salidaNormMins = 22*60+30 }

      // Si hay override de salida_efectiva del admin, usarlo directo (es el valor aprobado)
      let salidaEfectiva: string | null = ov?.salida_efectiva || null

      // Si no hay override, calcular desde hora_salida raw
      if (!salidaEfectiva && a.hora_salida && turno) {
        const outMins = toMins(a.hora_salida)
        if (turno === 'T1') salidaEfectiva = (outMins >= 900 && outMins <= 950) ? '15:30' : a.hora_salida
        else if (turno === 'T2') salidaEfectiva = (outMins >= 1335 && outMins <= 1370) ? '22:30' : a.hora_salida
      }

      let minutosExtra = 0, horasExtra = 0, horasRecargo = 0
      if (salidaEfectiva && salidaNormMins > 0) {
        const efMins = toMins(salidaEfectiva)
        minutosExtra = Math.max(0, efMins - salidaNormMins)
        horasExtra   = Math.round((minutosExtra / 60) * 100) / 100
        if (efMins >= 22*60+30) horasRecargo = Math.round((Math.max(0, efMins - 19*60) / 60) * 100) / 100
      } else if (a.hora_salida) {
        const salMins = toMins(a.hora_salida)
        if (salMins >= 22*60+30) horasRecargo = Math.round((Math.max(0, salMins - 19*60) / 60) * 100) / 100
      }

      return {
        fecha:                a.fecha,
        turno,
        hora_ingreso:         horaIngresoEfec,
        hora_salida:          a.hora_salida,
        salida_norm:          salidaNorm,
        salida_efectiva:      salidaEfectiva,
        minutos_extra:        minutosExtra,
        horas_extra:          horasExtra,
        horas_recargo:        horasRecargo,
        aprobado:             esAprobado,
        rechazado:            esRechazado,
        aprobado_por_nombre:  esAprobado ? (apro?.aprobado_por_nombre ?? null) : null,
        es_jornada_adicional: false,
      }
    })
    .filter(r => r.minutos_extra > 0 || r.horas_recargo > 0 || r.aprobado || r.rechazado)

  // Registros aprobados sin asistencia (override o registro manual)
  const registrosSinAsistencia = fechasAprobadas.map(fecha => {
    const apro = aproMap[fecha]
    const ov   = ovMap[fecha]
    const minExtra = ov?.horas_extra_manual ? Math.round(ov.horas_extra_manual * 60) : 0
    return {
      fecha,
      turno:                null as 'T1' | 'T2' | null,
      hora_ingreso:         null as string | null,
      hora_salida:          null as string | null,
      salida_norm:          null as string | null,
      salida_efectiva:      null as string | null,
      minutos_extra:        minExtra,
      horas_extra:          ov?.horas_extra_manual ?? 0,
      horas_recargo:        0,
      aprobado:             !apro.rechazado,
      rechazado:            apro.rechazado,
      aprobado_por_nombre:  !apro.rechazado ? (apro.aprobado_por_nombre ?? null) : null,
      es_jornada_adicional: minExtra > 0,
    }
  })

  const registros = [...registrosAsistencia, ...registrosSinAsistencia]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  // Totales: extra de aprobados, recargo de todos
  const aprobados = registros.filter(r => r.aprobado)
  const totales = {
    minutos_extra:  aprobados.reduce((s, r) => s + r.minutos_extra, 0),
    horas_extra:    Math.round(aprobados.reduce((s, r) => s + r.horas_extra, 0) * 100) / 100,
    horas_recargo:  Math.round(registros.reduce((s, r) => s + r.horas_recargo, 0) * 100) / 100,
    dias_aprobados: aprobados.length,
  }

  return NextResponse.json({ empleado, registros, fecha_inicio: fechaInicio, fecha_fin: fechaFin, totales })
}
