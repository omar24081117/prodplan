import { NextRequest, NextResponse } from 'next/server'

const CLAVE_PRODUCCION = process.env.PLANEACION_KEY  || 'Plan2026*'
const CLAVE_COMERCIAL  = process.env.COMERCIAL_KEY   || 'Comercial2026*'

export async function POST(request: NextRequest) {
  const { clave } = await request.json()
  if (!clave) return NextResponse.json({ error: 'Clave requerida' }, { status: 400 })
  if (clave === CLAVE_COMERCIAL)  return NextResponse.json({ ok: true, perfil: 'comercial' })
  if (clave === CLAVE_PRODUCCION) return NextResponse.json({ ok: true, perfil: 'produccion' })
  return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
}
