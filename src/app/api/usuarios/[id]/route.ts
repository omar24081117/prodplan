import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { password, nombre, panel_control } = await request.json()
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = {}
  if (password) updates.password = password

  // Actualizar user_metadata preservando campos existentes
  if (nombre !== undefined || panel_control !== undefined) {
    // Leer metadata actual del usuario
    const { data: userData } = await supabase.auth.admin.getUserById(id)
    const metaActual = userData?.user?.user_metadata || {}
    updates.user_metadata = {
      ...metaActual,
      ...(nombre !== undefined ? { nombre } : {}),
      ...(panel_control !== undefined ? { panel_control } : {}),
    }
  }

  const { error } = await supabase.auth.admin.updateUserById(id, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
