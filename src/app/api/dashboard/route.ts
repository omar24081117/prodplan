import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
  }

  const supabase = await createClient()

  // Jornadas en el rango
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
    })
  }

  const jornadaIds = jornadas.map(j => j.id)

  // Actividades en esas jornadas
  const { data: actividades } = await supabase
    .from('actividades')
    .select('id, jornada_id, proceso, cantidad, personal_planeado')
    .in('jornada_id', jornadaIds)

  if (!actividades || actividades.length === 0) {
    return NextResponse.json({
      kpis: { meta: 0, ejecutado: 0, cumplimiento: 0, personal_planeado: 0 },
      por_proceso: [],
      por_dia: [],
    })
  }

  const actividadIds = actividades.map(a => a.id)

  // Reportes de esas actividades
  const { data: reportes } = await supabase
    .from('reportes')
    .select('actividad_id, cantidad')
    .in('actividad_id', actividadIds)

  const metaTotal = actividades.reduce((s, a) => s + (a.cantidad || 0), 0)
  const ejecutadoTotal = (reportes || []).reduce((s, r) => s + (r.cantidad || 0), 0)
  const personalTotal = actividades.reduce((s, a) => s + (a.personal_planeado || 0), 0)
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
      if (!procesosMap[act.proceso]) procesosMap[act.proceso] = { meta: 0, ejecutado: 0 }
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
  for (const j of jornadas) {
    diasMap[j.fecha] = { meta: 0, ejecutado: 0 }
  }
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

  return NextResponse.json({
    kpis: { meta: metaTotal, ejecutado: ejecutadoTotal, cumplimiento, personal_planeado: personalTotal },
    por_proceso,
    por_dia,
  })
}
