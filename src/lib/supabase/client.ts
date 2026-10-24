import { createBrowserClient } from '@supabase/ssr'
import { guardDatabase } from './guard'

// The browser cannot see the deployment's environment: next.config.ts inlines the build's database verdict (R-3), and
// a blocked Preview gets the stub without ever creating a client (no session restore, no auth request).
export function createClient() {
  const blocked = process.env.MARKLENS_BROWSER_DB_BLOCKED
  if (blocked) return guardDatabase({} as ReturnType<typeof createBrowserClient>, blocked)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
