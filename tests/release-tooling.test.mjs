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
    const { checkedMigrations } = await import('../scripts/release/preflight.mjs')
    assert.equal((await db.query(check)).rows.length, checkedMigrations().length)
  } finally { await db.close() }
})

test('production readiness SQL: one read-only SELECT of counts, averages, privileges and flags; no row content', { skip: !process.env.PGLITE_MODULE }, async () => {
  const sql = readFileSync('scripts/release/production-readiness.sql', 'utf8')
  const code = sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''")
  assert.doesNotMatch(code, /\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate|copy|set|call|do|lock)\b/i)
  assert.equal(code.trim().replace(/;\s*$/, '').includes(';'), false, 'a single statement')
  assert.doesNotMatch(code, /\bemail\b|token|raw_content\s*,|select\s+\*/i) // never selects personal columns or whole rows
  const { previewInitSql } = await import('../scripts/release/build-preview-sql.mjs')
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon' $$;
      CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean);`)
    await db.exec(previewInitSql())
    await db.exec('BEGIN READ ONLY') // any write in the audit would fail here
    const rows = Object.fromEntries((await db.query(sql)).rows.map(r => [r.item, r.value]))
    await db.exec('ROLLBACK')
    assert.equal(rows['count: insights'], '3'); assert.equal(rows['count: subscribers active'], '0')
    assert.equal(rows['grant: authenticated SELECT insight_sessions'], 'true') // 025 applied in the bundle
    assert.equal(rows['flag: ig_auto_publish'], 'off')
    assert.ok(Number(rows['avg bytes: insights row']) > 0)
    // Batch-1 preconditions, as they read once 017/023/024/025 are in.
    assert.equal(rows['pre 017: insights columns its trigger reads (of 20)'], '20'); assert.equal(rows['pre 017: missing insights columns'], 'none')
    assert.equal(rows['pre 017: function behind trigger insights_updated_at'], 'update_insight_content_updated_at')
    assert.equal(rows['pre 023: cardnews columns already present (of 8)'], '8'); assert.equal(rows['pre 023: publish-state constraints already present (of 2)'], '2')
    assert.equal(rows['pre 024: ai_usage or consume_ai_quota already present'], 'true')
    assert.equal(rows['pre 025: Insight Lab tables with RLS on (of 4)'], '4'); assert.equal(rows['pre 025: Insight Lab policies'], '10')
    // The full Insight Lab picture: exactly 025's privileges, RLS on, every policy listed, no RLS-less table exposed.
    assert.equal(rows['pre 025: privileges 025 grants already present (of 11)'], '11'); assert.equal(rows['pre 025: 025 privileges still missing'], 'none')
    assert.equal(rows['priv: insight_notes / authenticated'], 'SELECT,INSERT,UPDATE,DELETE'); assert.equal(rows['priv: insight_notes / anon'], 'none')
    assert.equal(rows['priv: insight_challenges / anon'], 'SELECT'); assert.equal(rows['rls: insight_sessions'], 'on')
    assert.equal(Object.keys(rows).filter(k => k.startsWith('policy: ')).length, 10)
    assert.match(rows['policy: insight_notes / notes_own_select'], /^SELECT to public using \(auth\.uid\(\) = user_id\)/)
    assert.equal(rows['exposure: public tables with RLS off that anon/authenticated can SELECT'], 'none')
  } finally { await db.close() }
})
