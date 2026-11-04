import { createBrowserClient } from '@supabase/ssr'
import { guardedClient } from './guard'

// The browser cannot see the deployment's environment: next.config.ts inlines the build's database verdict (R-3), and
// a blocked Preview gets the stub without ever creating a client (no session restore, no auth request).
export function createClient() {
  return guardedClient(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), process.env.MARKLENS_BROWSER_DB_BLOCKED || null)
}
