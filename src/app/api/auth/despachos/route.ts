import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROLES_PERMITIDOS = ['Director', 'Gerencia', 'Analista', 'Comercial', 'Almacenista']

export async function POST(request: NextRequest) {
  const { cedula } = await request.json()

  if (!cedula) {
    return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: persona, error } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (error || !persona) {
    return NextResponse.json({ error: 'Cédula no registrada o inactiva' }, { status: 401 })
  }

  const rol = persona.rol || 'Operario'

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return NextResponse.json({
      error: `Tu rol (${rol}) no tiene acceso a este módulo.`,
    }, { status: 403 })
  }

  const session = JSON.stringify({ cedula: persona.cedula, nombre: persona.nombre, rol })

  const response = NextResponse.json({ ok: true, nombre: persona.nombre, rol })
  response.cookies.set('despachos_session', session, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 12,
    sameSite: 'lax',
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('despachos_session', '', { path: '/', maxAge: 0 })
  return response
}
