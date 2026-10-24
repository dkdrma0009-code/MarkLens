import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewInitFiles, previewInitSql } from '../scripts/release/build-preview-sql.mjs'

// R-3: a new, empty Preview database can be built from the repository alone (migrations + the dashboard-made tables,
// inferred from code + synthetic seed); the same script refuses a database that already has MarkLens tables
// (production), and the read-only checks run on the result. PostgreSQL via PGlite with Supabase's roles/auth stubbed.
const require = createRequire(import.meta.url)
const SUPABASE_STUBS = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon' $$;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean);`

test('preview init: order is 001, dashboard tables, 002…024, seed', () => {
  const files = previewInitFiles()
  assert.equal(files[0], 'supabase/migrations/001_schema.sql')
  assert.equal(files[1], 'supabase/preview/001a_unmanaged_tables.sql')
  assert.equal(files.at(-1), 'supabase/preview/900_seed_synthetic.sql')
  assert.deepEqual(files.slice(2, -1).map(f => f.split('/').pop().slice(0, 3)), Array.from({ length: files.length - 3 }, (_, i) => String(i + 2).padStart(3, '0')))
  const seed = readFileSync('supabase/preview/900_seed_synthetic.sql', 'utf8')
  assert.doesNotMatch(seed, /@(?!example\.test)[a-z0-9-]+\.[a-z]/i, 'no real addresses in the seed')
  assert.match(seed, /\('ig_auto_publish', 'off'\)/)
})

test('preview init: builds a fresh database, refuses a non-empty one, and the release checks read it', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec(SUPABASE_STUBS)
    await db.exec(previewInitSql())
    await assert.rejects(db.exec(previewInitSql()), /already exist/)

    const present = (await db.query(readFileSync('scripts/release/check-production-schema.sql', 'utf8'))).rows
    assert.deepEqual(present.filter(r => !r.present).map(r => r.migration), [])

    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.insights i JOIN public.articles a ON a.id = i.article_id WHERE a.status = 'published'`)).rows[0].n, 3)
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.random_quiz('beginner', NULL, 5)`)).rows[0].n, 2)
    assert.equal((await db.query(`SELECT value FROM public.app_config WHERE key = 'ig_auto_publish'`)).rows[0].value, 'off')
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.subscribers`)).rows[0].n, 0)

    // The grants 006 sets, on the tables the dashboard made: anon may leave feedback, may not read subscribers.
    await db.exec(`SET ROLE anon; INSERT INTO public.feedback (insight_id, rating) SELECT id, 'helpful' FROM public.insights LIMIT 1; RESET ROLE`)
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query('SELECT email FROM public.subscribers'), /permission denied/)
    await assert.rejects(db.query('SELECT * FROM public.app_config'), /permission denied/)
    await db.exec('RESET ROLE')

    const describe = readFileSync('scripts/release/describe-unmanaged-schema.sql', 'utf8')
    assert.doesNotMatch(describe.replace(/--[^\n]*/g, ''), /\b(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/i)
    const results = await db.exec(describe)
    assert.ok(results[0].rows.some(r => r.table_name === 'insights' && r.column_name === 'hook'))
    assert.ok(results[2].rows[0].definition.includes('random_quiz'))
  } finally { await db.close() }
})
