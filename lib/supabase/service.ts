import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Server-side only: never import this
// from a client component. All data access goes through API route handlers,
// which enforce identity and roles via lib/auth.ts before touching the DB.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
