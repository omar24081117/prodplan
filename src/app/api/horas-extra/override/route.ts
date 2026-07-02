import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/horas-extra/override?fecha=YYYY-MM-DD
// Devuelve todos los overrides guardados para una fecha
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  if (!fecha) return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('horas_extra_overrides')
    .select('cedula, hora_ingreso, salida_efectiva, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, configurado_por_nombre, configurado_en')
    .eq('fecha', fecha)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/horas-extra/override
// Guarda (upsert) un override para una cédula/fecha
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cedula, fecha, hora_ingreso, salida_efectiva, horas_extra_manual, horas_nocturnas_manual, recargo_nocturno_manual, configurado_por_cedula, configurado_por_nombre } = body

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
