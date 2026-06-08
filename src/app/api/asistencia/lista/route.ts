import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha       = searchParams.get('fecha')
  const fechaInicio = searchParams.get('fecha_inicio')
  const fechaFin    = searchParams.get('fecha_fin')
  const supabase    = await createClient()

  // ── Todos los operarios activos (para saber la base total) ─────────────
  const { data: personal } = await supabase
    .from('personal')
    .select('cedula, rol')
    .eq('activo', true)

  const rolMap: Record<string, string> = {}
  for (const p of personal ?? []) rolMap[p.cedula] = p.rol
  const totalOperarios = (personal ?? []).filter(p => p.rol === 'Operario').length

  // ── MODO RANGO ──────────────────────────────────────────────────────────
  if (fechaInicio && fechaFin) {
    const { data, error } = await supabase
      .from('asistencia')
      .select('cedula, nombre, fecha, hora_ingreso, hora_salida')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .not('hora_ingreso', 'is', null)
      .order('fecha', { ascending: true })
      .order('nombre', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const registros = (data ?? []).map(r => ({ ...r, rol: rolMap[r.cedula] ?? 'Otro' }))

    // Días únicos en el rango
    const diasUnicos = [...new Set(registros.map(r => r.fecha))]
    const diasEnRango = diasUnicos.length

    // Asistencia de operarios por día
    const asistOperariosPorDia = diasUnicos.map(d => ({
      fecha: d,
      count: registros.filter(r => r.fecha === d && r.rol === 'Operario').length,
    }))

    const promedioOperarios = diasEnRango > 0
      ? Math.round((asistOperariosPorDia.reduce((s, d) => s + d.count, 0) / diasEnRango) * 10) / 10
      : 0

    // Resumen por empleado (solo operarios)
    const empleadoMap: Record<string, { cedula: string; nombre: string; rol: string; dias: number; dias_lista: string[] }> = {}
    for (const r of registros) {
      if (!empleadoMap[r.cedula]) {
        empleadoMap[r.cedula] = { cedula: r.cedula, nombre: r.nombre, rol: r.rol, dias: 0, dias_lista: [] }
      }
      empleadoMap[r.cedula].dias++
      empleadoMap[r.cedula].dias_lista.push(r.fecha)
    }

    return NextResponse.json({
      modo: 'rango',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      registros,
      resumen_empleados: Object.values(empleadoMap).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      estadisticas: {
        total_operarios_sistema: totalOperarios,
        dias_en_rango: diasEnRango,
        promedio_operarios_dia: promedioOperarios,
        asistencia_por_dia: asistOperariosPorDia,
        pct_promedio: totalOperarios > 0 ? Math.round((promedioOperarios / totalOperarios) * 100) : 0,
      },
    })
  }

  // ── MODO DÍA ────────────────────────────────────────────────────────────
  const diaConsulta = fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const { data, error } = await supabase
    .from('asistencia')
    .select('cedula, nombre, hora_ingreso, hora_salida')
    .eq('fecha', diaConsulta)
    .not('hora_ingreso', 'is', null)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const registros = (data ?? []).map(r => ({ ...r, rol: rolMap[r.cedula] ?? 'Otro' }))

  return NextResponse.json({
    modo: 'dia',
    fecha: diaConsulta,
    registros,
    estadisticas: { total_operarios_sistema: totalOperarios },
  })
}
