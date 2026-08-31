import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GESTORES_COMPRAS    = new Set(['1061795021'])
const GESTORES_MENSAJERIA = new Set(['1193569479'])
const ROLES_ADMIN         = new Set(['Director', 'Gerente'])

export async function POST(req: NextRequest) {
  try {
    const { cedula, modulo } = await req.json()
    if (!cedula || !modulo) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: persona } = await supabase
      .from('personal')
      .select('cedula, nombre, rol')
      .eq('cedula', String(cedula).trim())
      .single()

    if (!persona) return NextResponse.json({ error: 'Cédula no encontrada' }, { status: 404 })

    const cedStr = String(cedula).trim()
    const puedeGestionar =
      ROLES_ADMIN.has(persona.rol) ||
      (modulo === 'compras'    && GESTORES_COMPRAS.has(cedStr))    ||
      (modulo === 'mensajeria' && GESTORES_MENSAJERIA.has(cedStr))

    return NextResponse.json({ nombre: persona.nombre, rol: persona.rol, puedeGestionar })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
