import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  // Protección /admin/* — requiere sesión Supabase Auth
  if (pathname.startsWith('/admin')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/?error=admin_required', request.url))
    }
  }

  // Protección /ejecucion/* — requiere cookie operario_session
  if (pathname.startsWith('/ejecucion')) {
    const operarioSession = request.cookies.get('operario_session')
    if (!operarioSession) {
      return NextResponse.redirect(new URL('/?error=operario_required', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/ejecucion/:path*'],
}
