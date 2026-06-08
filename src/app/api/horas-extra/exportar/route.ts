import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${d}/${MESES[parseInt(m)-1]}/${y}`
}

function calcular(
  horaIngreso: string | null,
  horaSalida: string | null,
  horaEfectiva: string | null,
  horasExtraManual?: number | null,
): {
  turno: string
  entradaNorm: string
  salidaNorm: string
  salidaEfectiva: string
  minutosExtra: number
  horasExtra: number
  horasRecargo: number
} {
  // Si hay manual override
  if (horasExtraManual && horasExtraManual > 0) {
    const inMins = toMins(horaIngreso ?? '')
    let turno = '—', entradaNorm = '—', salidaNorm = '—'
    if (inMins >= 300 && inMins <= 450)  { turno = 'T1'; entradaNorm = '06:00'; salidaNorm = '15:30' }
    else if (inMins >= 720 && inMins <= 900) { turno = 'T2'; entradaNorm = '13:00'; salidaNorm = '22:30' }
    return {
      turno: 'MAN', entradaNorm, salidaNorm,
      salidaEfectiva: horaSalida ?? '—',
      minutosExtra: Math.round(horasExtraManual * 60),
      horasExtra: horasExtraManual,
      horasRecargo: 0,
    }
  }

  const inMins = toMins(horaIngreso ?? '')
  let turno = '—', entradaNorm = '—', salidaNorm = '—', salidaNormMins = -1

  if (inMins >= 300 && inMins <= 450) {
    turno = 'T1'; entradaNorm = '06:00'; salidaNorm = '15:30'; salidaNormMins = 15*60+30
  } else if (inMins >= 720 && inMins <= 900) {
    turno = 'T2'; entradaNorm = '13:00'; salidaNorm = '22:30'; salidaNormMins = 22*60+30
  }

  // Salida efectiva: usar la override si existe, sino calcular desde hora_salida
  let salidaEfectiva = horaEfectiva ?? horaSalida ?? '—'
  if (!horaEfectiva && horaSalida && salidaNormMins > 0) {
    const outMins = toMins(horaSalida)
    if (turno === 'T1' && outMins >= 900 && outMins <= 950) salidaEfectiva = '15:30'
    else if (turno === 'T2' && outMins >= 1335 && outMins <= 1370) salidaEfectiva = '22:30'
    else salidaEfectiva = horaSalida
  }

  let minutosExtra = 0, horasExtra = 0, horasRecargo = 0
  if (salidaEfectiva !== '—' && salidaNormMins > 0) {
    const efMins = toMins(salidaEfectiva)
    const extraMins = Math.max(0, efMins - salidaNormMins)
    minutosExtra = extraMins
    horasExtra = Math.round((extraMins / 60) * 100) / 100
    if (efMins >= 22*60+30) {
      horasRecargo = Math.round((Math.max(0, efMins - 19*60) / 60) * 100) / 100
    }
  }

  return { turno, entradaNorm, salidaNorm, salidaEfectiva, minutosExtra, horasExtra, horasRecargo }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const fechaInicio = searchParams.get('fecha_inicio') ?? hoy.slice(0, 7) + '-01'
  const fechaFin    = searchParams.get('fecha_fin')    ?? hoy

  const supabase = await createClient()

  // Solo operarios activos
  const { data: operarios } = await supabase
    .from('personal')
    .select('cedula')
    .eq('rol', 'Operario')
    .eq('activo', true)

  const cedulasOperarios = (operarios ?? []).map((o: { cedula: string }) => o.cedula)
  if (cedulasOperarios.length === 0) {
    return NextResponse.json({ error: 'Sin operarios' }, { status: 404 })
  }

  // Asistencias del rango
  const { data: asistencias, error } = await supabase
    .from('asistencia')
    .select('cedula, nombre, fecha, hora_ingreso, hora_salida')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .not('hora_ingreso', 'is', null)
    .in('cedula', cedulasOperarios)
    .order('fecha', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Overrides del rango
  const { data: overridesRaw } = await supabase
    .from('horas_extra_overrides')
    .select('cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const ovMap: Record<string, { hora_ingreso: string | null; salida_efectiva: string | null; horas_extra_manual: number | null }> = {}
  for (const ov of overridesRaw ?? []) {
    ovMap[`${ov.cedula}_${ov.fecha}`] = {
      hora_ingreso:       ov.hora_ingreso      ?? null,
      salida_efectiva:    ov.salida_efectiva   ?? null,
      horas_extra_manual: ov.horas_extra_manual ?? null,
    }
  }

  // Aprobaciones del rango
  const { data: aprobaciones } = await supabase
    .from('horas_extra_aprobaciones')
    .select('cedula, fecha, aprobado_por_nombre, rechazado')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const aproMap: Record<string, { nombre: string; rechazado: boolean }> = {}
  for (const a of aprobaciones ?? []) {
    aproMap[`${a.cedula}_${a.fecha}`] = {
      nombre:    a.aprobado_por_nombre,
      rechazado: !!a.rechazado,
    }
  }

  // ── Calcular registros ───────────────────────────────────────────────────
  type Fila = {
    FECHA: string
    NOMBRE: string
    'CÉDULA': string
    TRN: string
    'ENT.': string
    'E.N.': string
    'SAL.': string
    'S.N.': string
    'S.EFEC.': string
    'MIN+': number | string
    'HRS+': number | string
    'REC.': number | string
    ESTADO: string
    'APROBADO POR': string
  }

  const filas: Fila[] = []

  for (const a of asistencias ?? []) {
    const key = `${a.cedula}_${a.fecha}`
    const ov  = ovMap[key]
    const apro = aproMap[key]
    const esAprobado  = !!apro && !apro.rechazado
    const esRechazado = !!apro && apro.rechazado

    const horaIngreso  = ov?.hora_ingreso    ?? a.hora_ingreso
    const horaSalida   = a.hora_salida
    const horaEfectiva = ov?.salida_efectiva ?? null
    const hsManual     = ov?.horas_extra_manual ?? null

    const { turno, entradaNorm, salidaNorm, salidaEfectiva, minutosExtra, horasExtra, horasRecargo } =
      calcular(horaIngreso, horaSalida, horaEfectiva, hsManual)

    // Solo incluir si está aprobado O tiene recargo nocturno
    if (!esAprobado && horasRecargo === 0) continue

    const estado = esAprobado ? 'Aprobado' : esRechazado ? 'Rechazado' : 'Pendiente'

    filas.push({
      FECHA:          fmtFecha(a.fecha),
      NOMBRE:         a.nombre,
      'CÉDULA':       a.cedula,
      TRN:            turno,
      'ENT.':         horaIngreso ?? '—',
      'E.N.':         entradaNorm,
      'SAL.':         horaSalida ?? '—',
      'S.N.':         salidaNorm,
      'S.EFEC.':      salidaEfectiva,
      'MIN+':         minutosExtra > 0 ? minutosExtra : '—',
      'HRS+':         horasExtra  > 0 ? horasExtra   : '—',
      'REC.':         horasRecargo > 0 ? horasRecargo : '—',
      ESTADO:         estado,
      'APROBADO POR': esAprobado ? (apro?.nombre ?? '') : '',
    })
  }

  if (filas.length === 0) {
    return NextResponse.json({ error: 'No hay registros aprobados ni con recargo en el rango seleccionado.' }, { status: 404 })
  }

  // ── Hoja 1: Detalle ──────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(filas)
  ws1['!cols'] = [
    { wch: 14 }, // FECHA
    { wch: 28 }, // NOMBRE
    { wch: 14 }, // CÉDULA
    { wch: 6  }, // TRN
    { wch: 8  }, // ENT.
    { wch: 8  }, // E.N.
    { wch: 8  }, // SAL.
    { wch: 8  }, // S.N.
    { wch: 10 }, // S.EFEC.
    { wch: 8  }, // MIN+
    { wch: 8  }, // HRS+
    { wch: 8  }, // REC.
    { wch: 12 }, // ESTADO
    { wch: 24 }, // APROBADO POR
  ]

  XLSX.utils.book_append_sheet(wb, ws1, 'Detalle')

  // ── Hoja 2: Resumen por persona ──────────────────────────────────────────
  // Agrupar por cédula+nombre
  type ResumenPersona = {
    NOMBRE: string
    'CÉDULA': string
    'DÍAS CON EXTRA': number
    'TOTAL MIN+': number
    'TOTAL HRS+': number
    'TOTAL REC. NOCT.': number
  }

  const resumenMap: Record<string, ResumenPersona> = {}

  for (const f of filas) {
    const ced = f['CÉDULA'] as string
    if (!resumenMap[ced]) {
      resumenMap[ced] = {
        NOMBRE:            f.NOMBRE,
        'CÉDULA':          ced,
        'DÍAS CON EXTRA':  0,
        'TOTAL MIN+':      0,
        'TOTAL HRS+':      0,
        'TOTAL REC. NOCT.': 0,
      }
    }
    const r = resumenMap[ced]
    const mins = typeof f['MIN+'] === 'number' ? f['MIN+'] : 0
    const hrs  = typeof f['HRS+'] === 'number' ? f['HRS+'] : 0
    const rec  = typeof f['REC.'] === 'number' ? f['REC.'] : 0
    if (mins > 0 || hrs > 0) r['DÍAS CON EXTRA']++
    r['TOTAL MIN+']       += mins
    r['TOTAL HRS+']       = Math.round((r['TOTAL HRS+'] + hrs) * 100) / 100
    r['TOTAL REC. NOCT.'] = Math.round((r['TOTAL REC. NOCT.'] + rec) * 100) / 100
  }

  const resumenFilas = Object.values(resumenMap)
    .sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE))

  // Fila de totales resumen
  const totalResumenHrs = Math.round(resumenFilas.reduce((s, r) => s + r['TOTAL HRS+'], 0) * 100) / 100
  const totalResumenRec = Math.round(resumenFilas.reduce((s, r) => s + r['TOTAL REC. NOCT.'], 0) * 100) / 100
  const totalResumenMin = resumenFilas.reduce((s, r) => s + r['TOTAL MIN+'], 0)

  resumenFilas.push({
    NOMBRE:            `TOTALES (${resumenFilas.length} personas)`,
    'CÉDULA':          '',
    'DÍAS CON EXTRA':  resumenFilas.reduce((s, r) => s + r['DÍAS CON EXTRA'], 0),
    'TOTAL MIN+':      totalResumenMin,
    'TOTAL HRS+':      totalResumenHrs,
    'TOTAL REC. NOCT.': totalResumenRec,
  })

  const ws2 = XLSX.utils.json_to_sheet(resumenFilas)
  ws2['!cols'] = [
    { wch: 30 }, // NOMBRE
    { wch: 14 }, // CÉDULA
    { wch: 16 }, // DÍAS CON EXTRA
    { wch: 14 }, // TOTAL MIN+
    { wch: 14 }, // TOTAL HRS+
    { wch: 18 }, // TOTAL REC. NOCT.
  ]

  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por persona')

  // ── Generar buffer ───────────────────────────────────────────────────────
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

  const nombreArchivo = `horas-extra_${fechaInicio}_${fechaFin}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
