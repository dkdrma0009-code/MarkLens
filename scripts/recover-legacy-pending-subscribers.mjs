// Run only AFTER migration + hardened app deployment. Production --execute needs
// separate explicit user approval. No email/token/ID/error payload is printed.
// Default: node scripts/recover-legacy-pending-subscribers.mjs
// Approved execution: ... --execute --expect-count 2
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { recoverLegacyPending } from "../src/lib/newsletter/legacy-recovery.mjs"

try {
  const args = process.argv.slice(2)
  const execute = args[0] === "--execute"
  if (args.length && !(args.length === 3 && execute && args[1] === "--expect-count" && /^\d+$/.test(args[2]))) {
    throw new Error("Invalid recovery flags")
  }
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replaceAll("\uFEFF", "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replaceAll("\uFEFF", "").trim()
  if (!url || !key) throw new Error("Recovery environment missing")
  if (execute && (!process.env.BREVO_API_KEY || (process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site") !== "https://marklens.site")) {
    throw new Error("Recovery mail environment invalid")
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const summary = await recoverLegacyPending({ db, execute, expectedCount: execute ? Number(args[2]) : undefined })
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`)
  console.log(`Legacy pending candidates: ${summary.candidates}`)
  console.log(`Success count: ${summary.success}`)
  console.log(`Failure count: ${summary.failure}`)
  console.log(`Skipped count: ${summary.skipped}`)
  console.log(`Retry blocked count: ${summary.retryBlocked}`)
  if (summary.failure) process.exitCode = 1
} catch {
  console.error("Recovery aborted. Check flags, migration, environment and count; no private details logged.")
  process.exitCode = 1
}
