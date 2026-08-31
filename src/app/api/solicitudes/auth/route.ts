import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GESTORES_COMPRAS = new Set(['1061795021'])
const ROLES_ADMIN      = new Set(['Director', 'Gerente', 'Gerencia'])

// GET /api/solicitudes/auth?cedula=XXX  — verifica acceso al módulo (no Operario)
export async function GET(req: NextRequest) {
  const cedula = new URL(req.url).searchParams.get('cedula')
  if (!cedula) return NextResponse.json({ error: 'Falta cédula' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: persona } = await supabase
    .from('personal')
    .select('cedula, nombre, rol, rol_secundario')
    .eq('cedula', cedula.trim())
    .eq('activo', true)
    .single()

  if (!persona) return NextResponse.json({ error: 'Cédula no encontrada o inactiva' }, { status: 404 })
  if (persona.rol === 'Operario' && persona.rol_secundario !== 'Mensajero')
    return NextResponse.json({ error: 'Los operarios no tienen acceso a este módulo' }, { status: 403 })

  return NextResponse.json({ nombre: persona.nombre, rol: persona.rol, rol_secundario: persona.rol_secundario })
}

export async function POST(req: NextRequest) {
  try {
    const { cedula, modulo } = await req.json()
    if (!cedula || !modulo) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: persona } = await supabase
      .from('personal')
      .select('cedula, nombre, rol, rol_secundario')
      .eq('cedula', String(cedula).trim())
      .single()

    if (!persona) return NextResponse.json({ error: 'Cédula no encontrada' }, { status: 404 })

    const esMensajero = persona.rol === 'Mensajero' || persona.rol_secundario === 'Mensajero'
    const cedStr = String(cedula).trim()

    const puedeGestionar =
      ROLES_ADMIN.has(persona.rol) ||
      (modulo === 'compras'    && GESTORES_COMPRAS.has(cedStr)) ||
      (modulo === 'mensajeria' && esMensajero)

    return NextResponse.json({ nombre: persona.nombre, rol: persona.rol, rol_secundario: persona.rol_secundario, puedeGestionar })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
