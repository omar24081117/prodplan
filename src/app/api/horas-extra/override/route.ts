import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/horas-extra/override?fecha=YYYY-MM-DD
// GET /api/horas-extra/override?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  (rango)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = await createClient()
  let query = supabase
    .from('horas_extra_overrides')
    .select('cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, configurado_por_nombre, configurado_en')
    .order('fecha', { ascending: true })

  if (fecha) {
    query = query.eq('fecha', fecha)
  } else if (desde && hasta) {
    query = query.gte('fecha', desde).lte('fecha', hasta)
  } else {
    return NextResponse.json({ error: 'Se requiere fecha o desde+hasta' }, { status: 400 })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/horas-extra/override
// Guarda (upsert) un override para una cédula/fecha
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, minutos_alimentacion, configurado_por_cedula, configurado_por_nombre } = body

  if (!cedula || !fecha) {
    return NextResponse.json({ error: 'cedula y fecha requeridos' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('horas_extra_overrides')
    .upsert({
      cedula,
      fecha,
      hora_ingreso:            hora_ingreso           ?? null,
      salida_efectiva:         salida_efectiva        ?? null,
      horas_extra_manual:      horas_extra_manual      != null ? Number(horas_extra_manual)      : null,
      horas_nocturnas_manual:  horas_nocturnas_manual  != null ? Number(horas_nocturnas_manual)  : null,
      recargo_nocturno_manual: recargo_nocturno_manual != null ? Number(recargo_nocturno_manual) : null,
      minutos_alimentacion:    minutos_alimentacion    != null ? Number(minutos_alimentacion)    : null,
      configurado_por_cedula: configurado_por_cedula ?? null,
      configurado_por_nombre: configurado_por_nombre ?? null,
      configurado_en: new Date().toISOString(),
    }, { onConflict: 'cedula,fecha' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/horas-extra/override?cedula=X&fecha=YYYY-MM-DD
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cedula = searchParams.get('cedula')
  const fecha  = searchParams.get('fecha')
  if (!cedula || !fecha) return NextResponse.json({ error: 'cedula y fecha requeridos' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('horas_extra_overrides')
    .delete()
    .eq('cedula', cedula)
    .eq('fecha', fecha)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
