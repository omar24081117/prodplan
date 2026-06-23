import { NextRequest, NextResponse } from 'next/server'

const CLAVE = process.env.PLANEACION_KEY || 'Plan2026*'

export async function POST(request: NextRequest) {
  const { clave } = await request.json()
  if (!clave || clave !== CLAVE) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
