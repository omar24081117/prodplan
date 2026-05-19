import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HORAS_POR_TURNO: Record<string, string[]> = {
  'MAÑANA': [
    '06:00-07:00','07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
    '12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00',
  ],
  'TARDE': [
    '13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00',
    '18:00-19:00','19:00-20:00','20:00-21:00','21:00-22:00',
  ],
  'NOCHE': [
    '22:00-23:00','23:00-00:00','00:00-01:00','01:00-02:00',
    '02:00-03:00','03:00-04:00','04:00-05:00','05:00-06:00',
  ],
}
function horasTurno(turno: string): string[] {
  return HORAS_POR_TURNO[turno] ?? HORAS_POR_TURNO['MAÑANA']
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: jornadas } = await supabase
    .from('jornadas')
    .select('id, fecha, personal_disponible')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (!jornadas || jornadas.length === 0) {
    return NextResponse.json({
      kpis: { meta: 0, ejecutado: 0, cumplimiento: 0, personal_planeado: 0 },
      por_proceso: [],
      por_dia: [],
      por_actividad: [],
    })
  }

  const jornadaIds = jornadas.map(j => j.id)

  const { data: actividades } = await supabase
    .from('actividades')
    .select('id, jornada_id, sku, producto, proceso, turno, cantidad, personal_planeado, lote')
    .in('jornada_id', jornadaIds)
    .order('proceso', { ascending: true })

  if (!actividades || actividades.length === 0) {
    return NextResponse.json({
      kpis: { meta: 0, ejecutado: 0, cumplimiento: 0, personal_planeado: 0 },
      por_proceso: [],
      por_dia: [],
      por_actividad: [],
    })
  }

  const actividadIds = actividades.map(a => a.id)

  const { data: reportes } = await supabase
    .from('reportes')
    .select('actividad_id, hora, cantidad, tiempo_improductivo, observacion')
    .in('actividad_id', actividadIds)

  const metaTotal = actividades.reduce((s, a) => s + (a.cantidad || 0), 0)
  const ejecutadoTotal = (reportes || []).reduce((s, r) => s + (r.cantidad || 0), 0)
  const personalTotal = actividades.reduce((s, a) => s + (a.personal_planeado || 0), 0)
  const tiempoImproductivoTotal = (reportes || []).reduce((s, r) => s + (r.tiempo_improductivo || 0), 0)
  const cumplimiento = metaTotal > 0 ? Math.round((ejecutadoTotal / metaTotal) * 100) : 0

  // Por proceso
  const procesosMap: Record<string, { meta: number; ejecutado: number }> = {}
  for (const a of actividades) {
    if (!procesosMap[a.proceso]) procesosMap[a.proceso] = { meta: 0, ejecutado: 0 }
    procesosMap[a.proceso].meta += a.cantidad || 0
  }
  for (const r of reportes || []) {
    const act = actividades.find(a => a.id === r.actividad_id)
    if (act) {
      procesosMap[act.proceso].ejecutado += r.cantidad || 0
    }
  }
  const por_proceso = Object.entries(procesosMap).map(([proceso, vals]) => ({
    proceso,
    meta: vals.meta,
    ejecutado: vals.ejecutado,
    cumplimiento: vals.meta > 0 ? Math.round((vals.ejecutado / vals.meta) * 100) : 0,
  })).sort((a, b) => b.meta - a.meta)

  // Por día
  const diasMap: Record<string, { meta: number; ejecutado: number }> = {}
  for (const j of jornadas) diasMap[j.fecha] = { meta: 0, ejecutado: 0 }
  for (const a of actividades) {
    const j = jornadas.find(j => j.id === a.jornada_id)
    if (j) diasMap[j.fecha].meta += a.cantidad || 0
  }
  for (const r of reportes || []) {
    const act = actividades.find(a => a.id === r.actividad_id)
    if (act) {
      const j = jornadas.find(j => j.id === act.jornada_id)
      if (j) diasMap[j.fecha].ejecutado += r.cantidad || 0
    }
  }
  const por_dia = Object.entries(diasMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, vals]) => ({
      fecha,
      meta: vals.meta,
      ejecutado: vals.ejecutado,
      cumplimiento: vals.meta > 0 ? Math.round((vals.ejecutado / vals.meta) * 100) : 0,
    }))

  // Por actividad — detalle hora a hora
  const por_actividad = actividades.map(a => {
    const repsActividad = (reportes || []).filter(r => r.actividad_id === a.id)
    const ejecutado = repsActividad.reduce((s, r) => s + (r.cantidad || 0), 0)
    const HORAS = horasTurno(a.turno)
    // Estándar real = unidades producidas / horas con reporte ingresado
    const horasConReporte = repsActividad.filter(r => r.cantidad != null && r.cantidad > 0).length
    const estandar_hora = horasConReporte > 0 ? Math.round(ejecutado / horasConReporte) : 0
    const jornada = jornadas.find(j => j.id === a.jornada_id)
    const horas = HORAS.map(h => {
      const rep = repsActividad.find(r => r.hora === h)
      return {
        hora: h,
        cantidad: rep?.cantidad ?? null,
        tiempo_improductivo: rep?.tiempo_improductivo ?? null,
        observacion: rep?.observacion ?? null,
        cumplimiento_hora: estandar_hora > 0 && rep
          ? Math.round(((rep.cantidad || 0) / estandar_hora) * 100)
          : null,
      }
    })
    const tiempoImproductivoActividad = repsActividad.reduce((s, r) => s + (r.tiempo_improductivo || 0), 0)
    return {
      id: a.id,
      fecha: jornada?.fecha ?? '',
      sku: a.sku,
      producto: a.producto,
      proceso: a.proceso,
      turno: a.turno,
      lote: a.lote,
      meta: a.cantidad,
      ejecutado,
      personal_planeado: a.personal_planeado,
      estandar_hora,
      cumplimiento: a.cantidad > 0 ? Math.round((ejecutado / a.cantidad) * 100) : 0,
      tiempo_improductivo: tiempoImproductivoActividad,
      horas,
    }
  })

  return NextResponse.json({
    kpis: { meta: metaTotal, ejecutado: ejecutadoTotal, cumplimiento, personal_planeado: personalTotal, tiempo_improductivo: tiempoImproductivoTotal },
    por_proceso,
    por_dia,
    por_actividad,
  })
}
