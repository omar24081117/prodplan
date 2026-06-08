import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('despachos_session')?.value
  if (!raw) return NextResponse.json({ sesion: null })
  try {
    const sesion = JSON.parse(raw)
    return NextResponse.json({ sesion })
  } catch {
    return NextResponse.json({ sesion: null })
  }
}
