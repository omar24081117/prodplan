import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') || new Date().toLocaleDateString('en-CA')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('asistencia')
    .select('cedula, nombre, hora_ingreso, hora_salida')
    .eq('fecha', fecha)
    .not('hora_ingreso', 'is', null)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
