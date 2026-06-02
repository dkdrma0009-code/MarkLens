import { createClient } from '@supabase/supabase-js'

const BOM = '﻿'

export function createAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(BOM, '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(BOM, '').trim()
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
