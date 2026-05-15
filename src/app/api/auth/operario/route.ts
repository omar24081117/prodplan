import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { cedula } = await request.json()

  if (!cedula) {
    return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: operario, error } = await supabase
    .from('personal')
    .select('cedula, nombre')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (error || !operario) {
    return NextResponse.json({ error: 'Cédula no registrada o inactiva' }, { status: 401 })
  }

  const session = JSON.stringify({ cedula: operario.cedula, nombre: operario.nombre })

  const response = NextResponse.json({ ok: true, nombre: operario.nombre })
  response.cookies.set('operario_session', session, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 12, // 12 horas
    sameSite: 'lax',
  })

  return response
}
