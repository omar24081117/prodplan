import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Correo super-administrador del panel: siempre tiene acceso si se autentica correctamente
const SUPER_ADMIN_EMAIL = 'direccion.produccion@naturesse.co'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
  }

  // Normalizar email: quitar tildes y espacios (ej: producción → produccion)
  const emailClean = email.trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

  // 1. Autenticar con email + password (establece la sesión)
  const supabase = await createClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: emailClean,
    password,
  })

  if (signInError || !signInData?.user) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  // 2. Usar el email canónico de la sesión (no el que escribió el usuario)
  const usuarioId    = signInData.user.id
  const emailReal    = (signInData.user.email || '').toLowerCase()
  const metadata     = signInData.user.user_metadata || {}

  const adminClient = createAdminClient()

  const res = NextResponse.json({ ok: true })
  res.cookies.set('prodplan_modo', 'panel', { path: '/', httpOnly: false, maxAge: 60 * 60 * 8 })

  // Super-admin: siempre tiene acceso y se le activa el flag si falta
  if (emailReal === SUPER_ADMIN_EMAIL.toLowerCase()) {
    if (!metadata.panel_control) {
      await adminClient.auth.admin.updateUserById(usuarioId, {
        user_metadata: { ...metadata, panel_control: true },
      })
    }
    return res
  }

  // Resto de usuarios: requieren panel_control = true
  if (metadata.panel_control !== true) {
    return NextResponse.json({ error: 'No tienes autorización para acceder al Panel de Control' }, { status: 403 })
  }

  return res
}
