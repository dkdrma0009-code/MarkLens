import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewInitFiles, previewInitSql } from '../scripts/release/build-preview-sql.mjs'
import { compareRows, parseRows, previewRows } from '../scripts/release/compare-unmanaged-schema.mjs'

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

    // One result set (the SQL Editor shows only the last one), so the whole description downloads as one CSV.
    const describe = (await db.query(readFileSync('scripts/release/describe-unmanaged-schema.sql', 'utf8'))).rows
    assert.ok(describe.some(r => r.section === '1 column' && r.object === 'insights' && r.name === 'hook'))
    assert.ok(describe.some(r => r.section === '9 function body' && r.detail.includes('quiz_questions')))
    assert.deepEqual(describe.filter(r => r.section === '0 table').map(r => r.detail), Array(7).fill('present'))
  } finally { await db.close() }
})

test('describe: one read-only SELECT over catalogs; policy literals are masked', { skip: !process.env.PGLITE_MODULE }, async () => {
  const sql = readFileSync('scripts/release/describe-unmanaged-schema.sql', 'utf8')
  const code = sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''")
  assert.doesNotMatch(code, /\b(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate|copy|set|call|do|lock|vacuum|analyze|refresh|nextval|setval|pg_sleep|dblink|lo_\w+|pg_read_\w+)\b/i)
  assert.equal(code.trim().replace(/;\s*$/, '').includes(';'), false, 'a single statement')
  // Outside pg_catalog / information_schema the query reads only storage.buckets (names and public flag).
  const sources = [...new Set([...code.matchAll(/\b(?:from|join)\s+([a-z_][a-z_.]*)/gi)].map(m => m[1].toLowerCase()))]
  assert.deepEqual(sources.filter(s => !/^(t|rel|fn|rows|pg_[a-z_]+|information_schema\.[a-z_]+)$/.test(s)), ['storage.buckets'])

  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec(SUPABASE_STUBS)
    await db.exec(`CREATE TABLE public.feedback (id int); ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own ON public.feedback FOR SELECT TO authenticated USING (auth.role() = 'person@real-domain.kr')`)
    const rows = (await db.query(sql)).rows
    const policy = rows.find(r => r.section === '7 policy')
    assert.match(policy.detail, /USING .*'…'/); assert.doesNotMatch(JSON.stringify(rows), /real-domain/)
    assert.deepEqual(rows.filter(r => r.section === '0 table' && r.detail === 'MISSING').map(r => r.object), ['app_config', 'cardnews', 'competitions', 'follower_snapshots', 'quiz_questions', 'site_feedback'])
  } finally { await db.close() }
})

test('compare: matches itself; tells a wrong inference from a migration production has not applied', { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const preview = await previewRows(PGlite)
  const all = new Set(Array.from({ length: 24 }, (_, i) => String(i + 1).padStart(3, '0')))
  assert.deepEqual(compareRows(preview, preview, all), {})

  // A production that lacks 023, has a NOT NULL caption, an extra index, and no anon INSERT grant on feedback.
  const without023 = new Set([...all].filter(n => n !== '023'))
  const production = preview
    .filter(r => r.from !== '023_cardnews_channel_publish_state' && !(r.section === '8 grant' && r.object === 'feedback' && r.name === 'anon'))
    .map(r => r.section === '1 column' && r.object === 'cardnews' && r.name === 'caption' ? { ...r, detail: 'text NOT NULL' } : r)
    .concat({ section: '4 index', object: 'cardnews', name: 'cardnews_scheduled_at_idx', detail: 'CREATE INDEX cardnews_scheduled_at_idx ON public.cardnews USING btree (scheduled_at)' })
  const diffs = compareRows(preview, production, without023)
  const kinds = object => diffs[object].map(d => `${d.kind} ${d.section} ${d.name}`).sort()
  assert.ok(kinds('cardnews').includes('DIFFERENT 1 column caption'))
  assert.ok(kinds('cardnews').includes('ONLY_PRODUCTION 4 index cardnews_scheduled_at_idx'))
  const from023 = diffs.cardnews.filter(d => d.from === '023_cardnews_channel_publish_state')
  assert.ok(from023.length >= 2 && from023.every(d => d.kind === 'NOT_APPLIED_IN_PRODUCTION'), JSON.stringify(from023))
  assert.deepEqual(kinds('feedback'), ['ONLY_PREVIEW 8 grant anon']) // 006 is applied there, so this is a real difference

  const csv = 'section,object,name,detail\r\n"9 function body",random_quiz,"p_level text, p_type text","SELECT ""data"" FROM x\nWHERE y"\r\n'
  assert.deepEqual(parseRows(csv), [{ section: '9 function body', object: 'random_quiz', name: 'p_level text, p_type text', detail: 'SELECT "data" FROM x\nWHERE y' }])

  // CLI on downloads shaped like the SQL Editor's: complete → MATCH (0); cut short by a row limit → inconclusive (2).
  const dir = mkdtempSync(path.join(tmpdir(), 'ml-describe-'))
  try {
    const q = v => `"${String(v).replace(/"/g, '""')}"`
    const rows = [...preview, { section: '99 end', object: 'rows', name: '', detail: String(preview.length) }]
    const write = (name, list) => { const f = path.join(dir, name); writeFileSync(f, 'section,object,name,detail\n' + list.map(r => [r.section, r.object, r.name, r.detail].map(q).join(',')).join('\n')); return f }
    const check = write('check.csv', [...all].filter(n => n !== '005').map(n => ({ section: n, object: 'x', name: '', detail: 'true' })))
    const run = file => spawnSync(process.execPath, ['scripts/release/compare-unmanaged-schema.mjs', file, check], { encoding: 'utf8', env: process.env })
    const full = run(write('full.csv', rows))
    assert.equal(full.status, 0, full.stdout + full.stderr); assert.match(full.stdout, /001a matches production/)
    assert.equal(run(write('cut.csv', rows.slice(0, 50))).status, 2)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
