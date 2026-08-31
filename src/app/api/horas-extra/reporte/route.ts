import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const toMins = (t: string) => {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const LUNES_LIBRE_DESDE = '2026-07-27'
function esLunesLibre(fecha: string): boolean {
  if (fecha < LUNES_LIBRE_DESDE) return false
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(y, mo - 1, d).getDay() === 1
}

function fmtFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${d}/${MESES[parseInt(m) - 1]}/${y}`
}

function calcular(
  horaIngreso: string | null,
  horaSalida: string | null,
  horaEfectiva: string | null,
  horasExtraManual?: number | null,
  diaLibre?: boolean,
): {
  entradaNorm: string
  salidaNorm: string
  salidaEfectiva: string
  minutosExtra: number
  horasExtra: number
  horasRecargo: number
} {
  if (horasExtraManual && horasExtraManual > 0) {
    const inMins = toMins(horaIngreso ?? '')
    let entradaNorm = '—', salidaNorm = '—'
    if (inMins >= 300 && inMins <= 450)      { entradaNorm = '06:00'; salidaNorm = '15:30' }
    else if (inMins >= 720 && inMins <= 900) { entradaNorm = '13:00'; salidaNorm = '22:30' }
    return {
      entradaNorm,
      salidaNorm,
      salidaEfectiva: horaSalida ?? '—',
      minutosExtra: Math.round(horasExtraManual * 60),
      horasExtra: horasExtraManual,
      horasRecargo: 0,
    }
  }

  const inMins = toMins(horaIngreso ?? '')

  // Día libre (lunes): todas las horas trabajadas son extras
  if (diaLibre && (horaEfectiva || horaSalida) && inMins >= 0) {
    const salidaReal = horaEfectiva ?? horaSalida ?? ''
    const outMins = toMins(salidaReal)
    const minutosExtra = Math.max(0, outMins - inMins)
    const horasExtra = Math.round((minutosExtra / 60) * 100) / 100
    let horasRecargo = 0
    if (outMins >= 22 * 60 + 30) {
      horasRecargo = Math.round((Math.max(0, outMins - 19 * 60) / 60) * 100) / 100
    }
    return { entradaNorm: '—', salidaNorm: '—', salidaEfectiva: salidaReal, minutosExtra, horasExtra, horasRecargo }
  }

  let entradaNorm = '—', salidaNorm = '—', salidaNormMins = -1

  if (inMins >= 300 && inMins <= 450) {
    entradaNorm = '06:00'; salidaNorm = '15:30'; salidaNormMins = 15 * 60 + 30
  } else if (inMins >= 720 && inMins <= 900) {
    entradaNorm = '13:00'; salidaNorm = '22:30'; salidaNormMins = 22 * 60 + 30
  }

  let salidaEfectiva = horaEfectiva ?? horaSalida ?? '—'
  if (!horaEfectiva && horaSalida && salidaNormMins > 0) {
    const outMins = toMins(horaSalida)
    if (inMins >= 300 && inMins <= 450 && outMins >= 900 && outMins <= 950)       salidaEfectiva = '15:30'
    else if (inMins >= 720 && inMins <= 900 && outMins >= 1335 && outMins <= 1370) salidaEfectiva = '22:30'
    else salidaEfectiva = horaSalida
  }

  let minutosExtra = 0, horasExtra = 0, horasRecargo = 0
  if (salidaEfectiva !== '—' && salidaNormMins > 0) {
    const efMins = toMins(salidaEfectiva)
    const extraMins = Math.max(0, efMins - salidaNormMins)
    minutosExtra = extraMins
    horasExtra = Math.round((extraMins / 60) * 100) / 100
    if (efMins >= 22 * 60 + 30) {
      horasRecargo = Math.round((Math.max(0, efMins - 19 * 60) / 60) * 100) / 100
    }
  }

  return { entradaNorm, salidaNorm, salidaEfectiva, minutosExtra, horasExtra, horasRecargo }
}

// GET /api/horas-extra/reporte?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD&contrato=Fijo|Temporal
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const fechaInicio = searchParams.get('fecha_inicio') ?? hoy.slice(0, 7) + '-01'
  const fechaFin    = searchParams.get('fecha_fin')    ?? hoy
  const contrato    = searchParams.get('contrato') === 'Temporal' ? 'Temporal' : 'Fijo'
  const rolesParam  = searchParams.get('roles')
  const roles       = rolesParam ? rolesParam.split(',') : ['Operario', 'Supervisor']

  const supabase = await createClient()

  // 1. Personal activo del tipo de contrato y roles indicados
  const { data: personalRaw, error: personalErr } = await supabase
    .from('personal')
    .select('cedula, nombre, rol')
    .eq('tipo_contrato', contrato)
    .in('rol', roles)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (personalErr) return NextResponse.json({ error: personalErr.message }, { status: 500 })

  const personal = personalRaw ?? []
  const cedulas = personal.map((p: { cedula: string }) => p.cedula)

  if (cedulas.length === 0) {
    return NextResponse.json({ error: `Sin personal ${contrato} activo` }, { status: 404 })
  }

  const nombreMap: Record<string, string> = {}
  const rolMap: Record<string, string>    = {}
  for (const p of personal) {
    nombreMap[p.cedula] = (p as { cedula: string; nombre: string }).nombre
    rolMap[p.cedula]    = (p as { cedula: string; rol: string }).rol
  }

  // 2. Asistencias del rango
  const { data: asistenciasRaw, error: asistErr } = await supabase
    .from('asistencia')
    .select('cedula, nombre, fecha, hora_ingreso, hora_salida')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .in('cedula', cedulas)
    .order('fecha', { ascending: true })
    .order('nombre', { ascending: true })

  if (asistErr) return NextResponse.json({ error: asistErr.message }, { status: 500 })

  // 3. Ausentismos del rango (solo aplica para Fijo)
  const { data: ausentismosRaw, error: ausErr } = contrato === 'Fijo'
    ? await supabase
        .from('ausentismos')
        .select('cedula, nombre, fecha, tipo')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .in('cedula', cedulas)
        .order('fecha', { ascending: true })
    : { data: [], error: null }

  if (ausErr) return NextResponse.json({ error: ausErr.message }, { status: 500 })

  // 4. Overrides del rango
  const { data: overridesRaw } = await supabase
    .from('horas_extra_overrides')
    .select('cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const ovMap: Record<string, {
    hora_ingreso: string | null
    salida_efectiva: string | null
    horas_extra_manual: number | null
  }> = {}
  for (const ov of overridesRaw ?? []) {
    ovMap[`${ov.cedula}_${ov.fecha}`] = {
      hora_ingreso:       ov.hora_ingreso       ?? null,
      salida_efectiva:    ov.salida_efectiva    ?? null,
      horas_extra_manual: ov.horas_extra_manual ?? null,
    }
  }

  // 5. Aprobaciones del rango
  const { data: aprobacionesRaw } = await supabase
    .from('horas_extra_aprobaciones')
    .select('cedula, fecha, aprobado_por_nombre, rechazado')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const aproMap: Record<string, { nombre: string; rechazado: boolean }> = {}
  for (const a of aprobacionesRaw ?? []) {
    aproMap[`${a.cedula}_${a.fecha}`] = {
      nombre:    a.aprobado_por_nombre,
      rechazado: !!a.rechazado,
    }
  }

  // ── Construir filas ───────────────────────────────────────────────────────
  type Fila = {
    FECHA: string
    'CÉDULA': string
    NOMBRE: string
    ROL: string
    'ENT.': string
    'E.N.': string
    'S.N.': string
    'S.EFEC.': string
    'MIN+': number | string
    'HRS+': number | string
    'REC.': number | string
    'TIPO AUSENTISMO': string
    'ESTADO HE': string
  }

  const filas: Fila[] = []

  // Asistencias
  for (const a of asistenciasRaw ?? []) {
    if (!a.hora_ingreso) continue

    const key  = `${a.cedula}_${a.fecha}`
    const ov   = ovMap[key]
    const apro = aproMap[key]
    const esAprobado  = !!apro && !apro.rechazado
    const esRechazado = !!apro && apro.rechazado

    const horaIngreso  = ov?.hora_ingreso    ?? a.hora_ingreso
    const horaSalida   = a.hora_salida       ?? null
    const horaEfectiva = ov?.salida_efectiva ?? null
    const hsManual     = ov?.horas_extra_manual ?? null

    // Día libre si es lunes ≥ 2026-07-27 y el empleado es Operario (o Temporal — ya filtrado por contrato)
    const diaLibre = esLunesLibre(a.fecha) && (contrato === 'Temporal' || rolMap[a.cedula] === 'Operario')

    const { entradaNorm, salidaNorm, salidaEfectiva, minutosExtra, horasExtra, horasRecargo } =
      calcular(horaIngreso, horaSalida, horaEfectiva, hsManual, diaLibre)

    let estadoHE = ''
    if (esAprobado) {
      estadoHE = 'Aprobado'
    } else if (esRechazado) {
      estadoHE = 'Rechazado'
    } else if (horasExtra > 0) {
      estadoHE = 'Pendiente'
    }

    filas.push({
      FECHA:             fmtFecha(a.fecha),
      'CÉDULA':          a.cedula,
      NOMBRE:            nombreMap[a.cedula] ?? a.nombre,
      ROL:               rolMap[a.cedula] ?? '—',
      'ENT.':            horaIngreso ?? '—',
      'E.N.':            entradaNorm,
      'S.N.':            salidaNorm,
      'S.EFEC.':         salidaEfectiva,
      'MIN+':            minutosExtra > 0 ? minutosExtra : '—',
      'HRS+':            horasExtra   > 0 ? horasExtra   : '—',
      'REC.':            horasRecargo > 0 ? horasRecargo : '—',
      'TIPO AUSENTISMO': '',
      'ESTADO HE':       estadoHE,
    })
  }

  // Ausentismos (solo los que no tienen asistencia ese día)
  const asistSet = new Set((asistenciasRaw ?? []).map(a => `${a.cedula}_${a.fecha}`))

  for (const aus of ausentismosRaw ?? []) {
    const key = `${aus.cedula}_${aus.fecha}`
    if (asistSet.has(key)) continue

    filas.push({
      FECHA:             fmtFecha(aus.fecha),
      'CÉDULA':          aus.cedula,
      NOMBRE:            nombreMap[aus.cedula] ?? aus.nombre,
      ROL:               rolMap[aus.cedula] ?? '—',
      'ENT.':            '',
      'E.N.':            '',
      'S.N.':            '',
      'S.EFEC.':         '',
      'MIN+':            '—',
      'HRS+':            '—',
      'REC.':            '—',
      'TIPO AUSENTISMO': aus.tipo,
      'ESTADO HE':       '',
    })
  }

  // Ordenar por fecha luego nombre
  filas.sort((a, b) => {
    const fa = a.FECHA, fb = b.FECHA
    if (fa < fb) return -1
    if (fa > fb) return 1
    return a.NOMBRE.localeCompare(b.NOMBRE)
  })

  // ── Generar Excel ─────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = [
    { wch: 14 }, // FECHA
    { wch: 14 }, // CÉDULA
    { wch: 28 }, // NOMBRE
    { wch: 12 }, // ROL
    { wch: 8  }, // ENT.
    { wch: 8  }, // E.N.
    { wch: 8  }, // S.N.
    { wch: 10 }, // S.EFEC.
    { wch: 8  }, // MIN+
    { wch: 8  }, // HRS+
    { wch: 8  }, // REC.
    { wch: 20 }, // TIPO AUSENTISMO
    { wch: 14 }, // ESTADO HE
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  const nombreArchivo = `reporte-asistencia-${contrato.toLowerCase()}_${fechaInicio}_${fechaFin}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
