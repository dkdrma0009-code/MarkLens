import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-2 release tooling: the env preflight refuses a Preview that could reach production and never prints a value;
// the read-only schema check tells present migrations from missing ones.
const require = createRequire(import.meta.url)
const SECRET = 'do-not-print-7f3a9c'
const base = { NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRET, SUPABASE_SERVICE_ROLE_KEY: SECRET, ADMIN_EMAIL: 'admin@example.test', CRON_SECRET: SECRET, N8N_WEBHOOK_SECRET: SECRET }
function preflight(env, target) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ml-preflight-'))
  try {
    const file = path.join(dir, '.env')
    writeFileSync(file, Object.entries(env).map(([k, v]) => `${k}="${v}"`).join('\n'))
    const run = spawnSync(process.execPath, ['scripts/release/preflight-env.mjs', file, target], { encoding: 'utf8' })
    return { code: run.status, out: run.stdout + run.stderr }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('preflight: an isolated Preview passes; a Preview on the production project or domain fails; values never printed', () => {
  const ok = preflight({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://previewtestproject01.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens-git-release.vercel.app', MARKLENS_DEPLOYMENT: 'preview' }, 'preview')
  assert.equal(ok.code, 0, ok.out)
  // R-3: the Preview must force its own classification rather than rely on Vercel exposing VERCEL_ENV at runtime.
  const unforced = preflight({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://previewtestproject01.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens-git-release.vercel.app' }, 'preview')
  assert.equal(unforced.code, 1); assert.match(unforced.out, /FAIL\s+MARKLENS_DEPLOYMENT \(preview\)/)
  const shared = preflight({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://ndehtnchkgvpjbxlkazk.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens.site', IG_ACCESS_TOKEN: SECRET, BREVO_API_KEY: SECRET }, 'preview')
  assert.equal(shared.code, 1)
  assert.match(shared.out, /FAIL\s+NEXT_PUBLIC_SUPABASE_URL \(isolation\)/); assert.match(shared.out, /FAIL\s+NEXT_PUBLIC_SITE_URL \(host\)/)
  assert.match(shared.out, /WARN\s+IG_ACCESS_TOKEN/); assert.match(shared.out, /WARN\s+BREVO_API_KEY/)
  const missing = preflight({ NEXT_PUBLIC_SUPABASE_URL: 'https://previewtestproject01.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://x.vercel.app' }, 'preview')
  assert.equal(missing.code, 1); assert.match(missing.out, /FAIL\s+CRON_SECRET/); assert.match(missing.out, /FAIL\s+ADMIN_EMAIL/)
  const prod = preflight({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://ndehtnchkgvpjbxlkazk.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens.site', BREVO_API_KEY: SECRET, GEMINI_API_KEY: SECRET }, 'production')
  assert.equal(prod.code, 0, prod.out)
  const forced = preflight({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://ndehtnchkgvpjbxlkazk.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens.site', MARKLENS_DEPLOYMENT: 'preview' }, 'production')
  assert.equal(forced.code, 1); assert.match(forced.out, /FAIL\s+MARKLENS_DEPLOYMENT/)
  for (const run of [ok, unforced, shared, missing, prod, forced]) assert.ok(!run.out.includes(SECRET), 'a value was printed')
})

test('schema check: read-only, and it tells present migrations from missing ones', { skip: !process.env.PGLITE_MODULE }, async () => {
  const check = readFileSync('scripts/release/check-production-schema.sql', 'utf8')
  assert.doesNotMatch(check.replace(/--[^\n]*/g, ''), /\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|set)\b/i)
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    const present = async () => (await db.query(check)).rows.filter(r => r.present).map(r => r.migration)
    assert.deepEqual(await present(), [])
    await db.exec('CREATE TABLE public.cardnews (article_id text PRIMARY KEY, posted_at timestamptz, ig_post_id text, publish_status text, reel_settings jsonb); CREATE TABLE public.subscribers (id int, email text, source text); REVOKE ALL ON public.subscribers FROM anon;')
    for (const m of ['023_cardnews_channel_publish_state', '024_ai_usage_quota']) await db.exec(readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    assert.deepEqual(await present(), ['006', '009', '013', '023', '024'])
    assert.equal((await db.query(check)).rows.length, 23)
  } finally { await db.close() }
})
