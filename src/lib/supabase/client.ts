import { createBrowserClient } from '@supabase/ssr'

function clean(val: string | undefined): string {
  const s = val ?? ''
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

export function createClient() {
  return createBrowserClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}
