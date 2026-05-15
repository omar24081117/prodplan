import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('operario_session')
  if (!cookie) return NextResponse.json({ operario: null })

  try {
    const operario = JSON.parse(cookie.value)
    return NextResponse.json({ operario })
  } catch {
    return NextResponse.json({ operario: null })
  }
}
