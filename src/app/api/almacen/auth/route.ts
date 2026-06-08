import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROLES_PERMITIDOS = ['Gerencia', 'Director', 'Almacenista']

export async function POST(request: NextRequest) {
  const { cedula } = await request.json()
  if (!cedula) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, activo')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Cédula no encontrada o inactivo' }, { status: 404 })
  if (!ROLES_PERMITIDOS.includes(data.rol)) {
    return NextResponse.json({ error: 'Sin acceso al módulo de almacén' }, { status: 403 })
  }

  return NextResponse.json({ usuario: data })
}
