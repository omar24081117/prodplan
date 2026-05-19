import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function clean(val: string | undefined): string {
  const s = val ?? ''
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — las cookies se manejan en middleware
          }
        },
      },
    }
  )
}
