import { createClient } from '@supabase/supabase-js'

function clean(val: string | undefined): string {
  const s = val ?? ''
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

export function createAdminClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
