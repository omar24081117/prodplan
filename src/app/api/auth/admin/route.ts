import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: 'admin@prodplan.com',
    password,
  })

  if (error) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('prodplan_modo', 'completo', { path: '/', httpOnly: false, maxAge: 60 * 60 * 8 })
  return res
}
