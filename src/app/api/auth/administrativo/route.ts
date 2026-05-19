import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  // No permitir login con el email del admin principal por esta ruta
  if (email.toLowerCase() === 'admin@prodplan.com') {
    return NextResponse.json({ error: 'Usa el acceso de Administrador' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
