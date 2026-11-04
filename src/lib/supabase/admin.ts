import { createClient } from '@supabase/supabase-js'
import { guardedClient } from './guard'

const BOM = '﻿'

export function createAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(BOM, '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(BOM, '').trim()
  return guardedClient(() => createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }))
}
