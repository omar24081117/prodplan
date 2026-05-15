import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const fecha = new Date().toLocaleDateString('en-CA')

  const { count } = await supabase
    .from('asistencia')
    .select('*', { count: 'exact', head: true })
    .eq('fecha', fecha)
    .not('hora_ingreso', 'is', null)

  return NextResponse.json({ total: count ?? 0 })
}
