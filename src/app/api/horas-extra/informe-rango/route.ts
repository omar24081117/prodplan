import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Faltan parámetros desde/hasta' }, { status: 400 })
  }

  const supabase = await createClient()

  const [{ data: overrides, error: e1 }, { data: apros }, { data: personal }] = await Promise.all([
    supabase
      .from('horas_extra_overrides')
      .select('cedula, fecha, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, recargo_diurno_manual, configurado_por_nombre')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true }),
    supabase
      .from('horas_extra_aprobaciones')
      .select('cedula, fecha, aprobado_por_nombre, rechazado')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    supabase.from('personal').select('cedula, nombre, tipo_contrato'),
  ])

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const nombreMap: Record<string, { nombre: string; contrato: string }> = {}
  for (const p of personal ?? []) nombreMap[String(p.cedula)] = { nombre: p.nombre, contrato: p.tipo_contrato ?? 'Fijo' }

  const aproMap: Record<string, { aprobado_por_nombre: string; rechazado: boolean }> = {}
  for (const a of apros ?? []) aproMap[`${a.cedula}_${a.fecha}`] = a

  type DetalleRow = { fecha: string; hrsExtra: number; hrsNoc: number; recargo: number; recargoDiurno: number; estado: string; aprobadoPor?: string }
  type PersonaRow = { cedula: string; nombre: string; contrato: string; hrsExtra: number; hrsNoc: number; recargo: number; recargoDiurno: number; aprobadas: number; pendientes: number; rechazadas: number; detalle: DetalleRow[] }

  const personaMap: Record<string, PersonaRow> = {}

  for (const ov of overrides ?? []) {
    const hrsExtra   = Number(ov.horas_extra_manual       ?? 0)
    const hrsNoc     = Number(ov.horas_nocturnas_manual   ?? 0)
    const rec        = Number(ov.recargo_nocturno_manual  ?? 0)
    const recD       = Number(ov.recargo_diurno_manual    ?? 0)

    if (hrsExtra === 0 && hrsNoc === 0 && rec === 0 && recD === 0) continue

    const key  = String(ov.cedula)
    const apro = aproMap[`${key}_${ov.fecha}`]
    const estado = apro ? (apro.rechazado ? 'Rechazado' : 'Aprobado') : 'Pendiente'

    if (!personaMap[key]) {
      personaMap[key] = {
        cedula: key,
        nombre: nombreMap[key]?.nombre ?? ov.configurado_por_nombre ?? key,
        contrato: nombreMap[key]?.contrato ?? 'Fijo',
        hrsExtra: 0, hrsNoc: 0, recargo: 0, recargoDiurno: 0,
        aprobadas: 0, pendientes: 0, rechazadas: 0,
        detalle: [],
      }
    }

    const p = personaMap[key]
    p.hrsExtra     += hrsExtra
    p.hrsNoc       += hrsNoc
    p.recargo      += rec
    p.recargoDiurno += recD
    if (estado === 'Aprobado')  p.aprobadas++
    else if (estado === 'Rechazado') p.rechazadas++
    else p.pendientes++

    p.detalle.push({ fecha: ov.fecha, hrsExtra, hrsNoc, recargo: rec, recargoDiurno: recD, estado, aprobadoPor: apro?.aprobado_por_nombre })
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
