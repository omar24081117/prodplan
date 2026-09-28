import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const LUNES_LIBRE_DESDE = '2026-07-27'
function esLunesLibre(fecha: string): boolean {
  if (fecha < LUNES_LIBRE_DESDE) return false
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(y, mo - 1, d).getDay() === 1
}

function calcularHrs(
  horaIngreso: string | null,
  horaSalida: string | null,
  salidaEfectiva: string | null,
  hsManual: number | null,
  diaLibre: boolean,
): { hrsExtra: number; hrsRecargo: number } {
  if (hsManual && hsManual > 0) return { hrsExtra: hsManual, hrsRecargo: 0 }
  if (!horaIngreso) return { hrsExtra: 0, hrsRecargo: 0 }

  const inMins = toMins(horaIngreso)

  if (diaLibre && (salidaEfectiva || horaSalida)) {
    const outMins = toMins(salidaEfectiva ?? horaSalida ?? '')
    const minutosExtra = Math.max(0, outMins - inMins)
    const hrsExtra = Math.round((minutosExtra / 60) * 100) / 100
    const hrsRecargo = outMins >= 22 * 60 + 30
      ? Math.round((Math.max(0, outMins - 19 * 60) / 60) * 100) / 100
      : 0
    return { hrsExtra, hrsRecargo }
  }

  let salidaNormMins = -1
  if (inMins >= 300 && inMins <= 450)      salidaNormMins = 15 * 60 + 30
  else if (inMins >= 720 && inMins <= 900) salidaNormMins = 22 * 60 + 30
  if (salidaNormMins < 0) return { hrsExtra: 0, hrsRecargo: 0 }

  let salidaReal = salidaEfectiva ?? horaSalida ?? null
  if (!salidaEfectiva && horaSalida) {
    const outMins = toMins(horaSalida)
    if (inMins >= 300 && inMins <= 450 && outMins >= 900 && outMins <= 950)         salidaReal = '15:30'
    else if (inMins >= 720 && inMins <= 900 && outMins >= 1335 && outMins <= 1370)  salidaReal = '22:30'
  }

  if (!salidaReal) return { hrsExtra: 0, hrsRecargo: 0 }

  const efMins     = toMins(salidaReal)
  const extraMins  = Math.max(0, efMins - salidaNormMins)
  const hrsExtra   = Math.round((extraMins / 60) * 100) / 100
  const hrsRecargo = efMins >= 22 * 60 + 30
    ? Math.round((Math.max(0, efMins - 19 * 60) / 60) * 100) / 100
    : 0
  return { hrsExtra, hrsRecargo }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Faltan parámetros desde/hasta' }, { status: 400 })
  }

  const supabase = await createClient()

  const [
    { data: asistencias, error: e1 },
    { data: overrides },
    { data: apros },
    { data: personal },
  ] = await Promise.all([
    supabase
      .from('asistencia')
      .select('cedula, nombre, fecha, hora_ingreso, hora_salida')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true }),
    supabase
      .from('horas_extra_overrides')
      .select('cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, recargo_diurno_manual, configurado_por_nombre')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    supabase
      .from('horas_extra_aprobaciones')
      .select('cedula, fecha, aprobado_por_nombre, rechazado')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    supabase.from('personal').select('cedula, nombre, tipo_contrato, rol'),
  ])

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const nombreMap: Record<string, { nombre: string; contrato: string; rol: string }> = {}
  for (const p of personal ?? []) {
    nombreMap[String(p.cedula)] = { nombre: p.nombre, contrato: p.tipo_contrato ?? 'Fijo', rol: p.rol ?? 'Operario' }
  }

  const ovMap: Record<string, {
    hora_ingreso: string | null
    salida_efectiva: string | null
    horas_extra_manual: number | null
    horas_nocturnas_manual: number | null
    recargo_nocturno_manual: number | null
    recargo_diurno_manual: number | null
    configurado_por_nombre: string | null
  }> = {}
  for (const ov of overrides ?? []) {
    ovMap[`${ov.cedula}_${ov.fecha}`] = {
      hora_ingreso:            ov.hora_ingreso            ?? null,
      salida_efectiva:         ov.salida_efectiva         ?? null,
      horas_extra_manual:      ov.horas_extra_manual      ?? null,
      horas_nocturnas_manual:  ov.horas_nocturnas_manual  ?? null,
      recargo_nocturno_manual: ov.recargo_nocturno_manual ?? null,
      recargo_diurno_manual:   ov.recargo_diurno_manual   ?? null,
      configurado_por_nombre:  ov.configurado_por_nombre  ?? null,
    }
  }

  const aproMap: Record<string, { aprobado_por_nombre: string; rechazado: boolean }> = {}
  for (const a of apros ?? []) aproMap[`${a.cedula}_${a.fecha}`] = a

  type DetalleRow = { fecha: string; hrsExtra: number; hrsNoc: number; recargo: number; recargoDiurno: number; estado: string; aprobadoPor?: string }
  type PersonaRow = { cedula: string; nombre: string; contrato: string; rol: string; hrsExtra: number; hrsNoc: number; recargo: number; recargoDiurno: number; aprobadas: number; pendientes: number; rechazadas: number; detalle: DetalleRow[] }

  const personaMap: Record<string, PersonaRow> = {}
  const asistSet = new Set<string>()

  for (const a of asistencias ?? []) {
    if (!a.hora_ingreso) continue

    const key      = `${a.cedula}_${a.fecha}`
    asistSet.add(key)
    const ov       = ovMap[key]
    const apro     = aproMap[key]
    const cedKey   = String(a.cedula)
    const info     = nombreMap[cedKey]
    const rol      = info?.rol ?? 'Operario'
    const contrato = info?.contrato ?? 'Fijo'

    let hrsExtra: number, hrsNoc: number, recargo: number, recargoDiurno: number

    const hasManualExtended = ov && (
      (ov.horas_nocturnas_manual  != null && Number(ov.horas_nocturnas_manual)  > 0) ||
      (ov.recargo_nocturno_manual != null && Number(ov.recargo_nocturno_manual) > 0) ||
      (ov.recargo_diurno_manual   != null && Number(ov.recargo_diurno_manual)   > 0)
    )

    if (hasManualExtended) {
      hrsExtra      = Number(ov.horas_extra_manual      ?? 0)
      hrsNoc        = Number(ov.horas_nocturnas_manual  ?? 0)
      recargo       = Number(ov.recargo_nocturno_manual ?? 0)
      recargoDiurno = Number(ov.recargo_diurno_manual   ?? 0)
    } else {
      const horaIngreso  = ov?.hora_ingreso    ?? a.hora_ingreso
      const horaSalida   = a.hora_salida       ?? null
      const salidaEf     = ov?.salida_efectiva ?? null
      const hsManual     = ov?.horas_extra_manual ?? null
      const diaLibre     = esLunesLibre(a.fecha) && (contrato === 'Temporal' || rol === 'Operario')
      const calc         = calcularHrs(horaIngreso, horaSalida, salidaEf, hsManual, diaLibre)
      hrsExtra      = calc.hrsExtra
      hrsNoc        = 0
      recargo       = calc.hrsRecargo
      recargoDiurno = 0
    }

    if (hrsExtra === 0 && hrsNoc === 0 && recargo === 0 && recargoDiurno === 0) continue

    const estado = apro ? (apro.rechazado ? 'Rechazado' : 'Aprobado') : 'Pendiente'
    if (estado !== 'Aprobado') continue

    if (!personaMap[cedKey]) {
      personaMap[cedKey] = {
        cedula: cedKey,
        nombre: info?.nombre ?? a.nombre ?? cedKey,
        contrato,
        rol,
        hrsExtra: 0, hrsNoc: 0, recargo: 0, recargoDiurno: 0,
        aprobadas: 0, pendientes: 0, rechazadas: 0,
        detalle: [],
      }
    }

    const p = personaMap[cedKey]
    p.hrsExtra      += hrsExtra
    p.hrsNoc        += hrsNoc
    p.recargo       += recargo
    p.recargoDiurno += recargoDiurno
    p.aprobadas++
    p.detalle.push({ fecha: a.fecha, hrsExtra, hrsNoc, recargo, recargoDiurno, estado, aprobadoPor: apro?.aprobado_por_nombre })
  }

  // Overrides sin asistencia ese día (entradas manuales puras)
  for (const ov of overrides ?? []) {
    const key = `${ov.cedula}_${ov.fecha}`
    if (asistSet.has(key)) continue

    const hrsExtra      = Number(ov.horas_extra_manual      ?? 0)
    const hrsNoc        = Number(ov.horas_nocturnas_manual  ?? 0)
    const recargo       = Number(ov.recargo_nocturno_manual ?? 0)
    const recargoDiurno = Number(ov.recargo_diurno_manual   ?? 0)
    if (hrsExtra === 0 && hrsNoc === 0 && recargo === 0 && recargoDiurno === 0) continue

    const apro   = aproMap[key]
    const estado = apro ? (apro.rechazado ? 'Rechazado' : 'Aprobado') : 'Pendiente'
    if (estado !== 'Aprobado') continue

    const cedKey = String(ov.cedula)
    const info   = nombreMap[cedKey]

    if (!personaMap[cedKey]) {
      personaMap[cedKey] = {
        cedula: cedKey,
        nombre: info?.nombre ?? ov.configurado_por_nombre ?? cedKey,
        contrato: info?.contrato ?? 'Fijo',
        rol: info?.rol ?? 'Operario',
        hrsExtra: 0, hrsNoc: 0, recargo: 0, recargoDiurno: 0,
        aprobadas: 0, pendientes: 0, rechazadas: 0,
        detalle: [],
      }
    }

    const p = personaMap[cedKey]
    p.hrsExtra      += hrsExtra
    p.hrsNoc        += hrsNoc
    p.recargo       += recargo
    p.recargoDiurno += recargoDiurno
    p.aprobadas++
    p.detalle.push({ fecha: ov.fecha, hrsExtra, hrsNoc, recargo, recargoDiurno, estado, aprobadoPor: apro?.aprobado_por_nombre })
  }

  const personas = Object.values(personaMap).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const totales = personas.reduce((acc, p) => ({
    hrsExtra:      acc.hrsExtra      + p.hrsExtra,
    hrsNoc:        acc.hrsNoc        + p.hrsNoc,
    recargo:       acc.recargo       + p.recargo,
    recargoDiurno: acc.recargoDiurno + p.recargoDiurno,
    aprobadas:     acc.aprobadas     + p.aprobadas,
    pendientes:    acc.pendientes    + p.pendientes,
    rechazadas:    acc.rechazadas    + p.rechazadas,
  }), { hrsExtra: 0, hrsNoc: 0, recargo: 0, recargoDiurno: 0, aprobadas: 0, pendientes: 0, rechazadas: 0 })

  return NextResponse.json({ totales, personas })
}
