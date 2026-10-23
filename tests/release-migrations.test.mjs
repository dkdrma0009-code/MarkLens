import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-2: the release migrations apply in order, are additive (code from before them keeps working, so rolling back the
// code never needs a database rollback), re-run safely, and 023/024 enforce their claims inside PostgreSQL.
// PGLITE_MODULE=<path to @electric-sql/pglite> enables the database checks (as for the other SQL tests).
const require = createRequire(import.meta.url)
const DIR = 'supabase/migrations/'
const files = readdirSync(DIR).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort()
const sql = name => readFileSync(DIR + files.find(f => f.startsWith(name)), 'utf8')
const statements = text => text.split('\n').filter(line => !/^\s*--/.test(line)).join('\n')

test('migrations: numbered 001…024 without gaps or duplicates; 016–024 are additive', () => {
  assert.deepEqual(files.map(f => f.slice(0, 3)), Array.from({ length: files.length }, (_, i) => String(i + 1).padStart(3, '0')))
  assert.ok(files.length >= 24)
  for (const file of files.filter(f => f >= '016')) {
    const body = statements(readFileSync(DIR + file, 'utf8'))
    assert.doesNotMatch(body, /\bdrop\s+(table|column|schema|view)\b|\brename\b|\balter\s+column\b|\btruncate\b|\bdelete\s+from\b/i, file)
    // Idempotent re-creation only: whatever is dropped is created again in the same file.
    for (const [, kind, name] of body.matchAll(/drop\s+(trigger|index)\s+if\s+exists\s+([\w.]+)/gi)) {
      assert.match(body, new RegExp(`create\\s+((unique|constraint)\\s+)?${kind}\\s+${name.split('.').pop()}\\b`, 'i'), `${file}: ${kind} ${name} re-created`)
    }
  }
})

const pg = process.env.PGLITE_MODULE
const roles = 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;'
const rollback = text => text.slice(text.indexOf('-- Rollback')).split('\n').filter(l => /^-- (BEGIN|ALTER|  DROP|DROP|COMMIT|BEGIN;)/.test(l) || /^--\s+(DROP|ALTER)/.test(l)).map(l => l.replace(/^--\s?/, '')).join('\n')

test('023: per-channel publish state — re-runnable, one claim wins, states constrained, old writes unaffected, rollback valid', { skip: !pg }, async () => {
  const { PGlite } = require(pg)
  const db = new PGlite()
  try {
    // cardnews predates the repository migrations; this is the subset of its columns the publisher touches.
    await db.exec(`${roles} CREATE TABLE public.cardnews (article_id text PRIMARY KEY, slides jsonb, caption text, posted_at timestamptz, ig_post_id text, publish_status text, scheduled_at timestamptz);
      INSERT INTO public.cardnews (article_id) VALUES ('a1'), ('a2');`)
    await db.exec(sql('023')); await db.exec(sql('023'))
    const claim = () => db.query(`UPDATE public.cardnews SET ig_publish_state='publishing', ig_publish_claimed_at=now() WHERE article_id='a1' AND posted_at IS NULL
      AND (publish_status IS NULL OR publish_status <> 'skipped_stale') AND (ig_publish_state IS NULL OR ig_publish_state='failed') RETURNING article_id`)
    const wins = (await Promise.all([claim(), claim(), claim()])).filter(r => r.rows.length).length
    assert.equal(wins, 1)
    await assert.rejects(db.query(`UPDATE public.cardnews SET threads_publish_state='posted' WHERE article_id='a1'`), /check/i)
    await db.query(`UPDATE public.cardnews SET threads_publish_state='needs_review', threads_publish_error='x' WHERE article_id='a1'`)
    // The publisher from before 023 writes only posted_at / ig_post_id — still valid on the new schema.
    await db.query(`UPDATE public.cardnews SET posted_at=now(), ig_post_id='ig' WHERE article_id='a2'`)
    assert.deepEqual((await db.query(`SELECT ig_publish_state, threads_publish_state FROM public.cardnews WHERE article_id='a2'`)).rows, [{ ig_publish_state: null, threads_publish_state: null }])
    await db.exec(rollback(sql('023')))
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='cardnews' AND column_name LIKE '%publish_state'`)).rows[0].n, 0)
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.cardnews`)).rows[0].n, 2)
  } finally { await db.close() }
})

test('024: AI quota — atomic under concurrency, per window and key, service_role only, rollback valid', { skip: !pg }, async () => {
  const { PGlite } = require(pg)
  const db = new PGlite()
  try {
    await db.exec(roles)
    await db.exec(sql('024')); await db.exec(sql('024'))
    const take = (key, limit, window = 86400) => db.query('SELECT public.consume_ai_quota($1, $2, $3, $4) AS ok', ['feature:chat', key, window, limit]).then(r => r.rows[0].ok)
    const results = await Promise.all(Array.from({ length: 10 }, () => take('ip:a', 4)))
    assert.equal(results.filter(Boolean).length, 4)
    assert.equal(await take('ip:a', 4), false)
    assert.equal(await take('ip:b', 4), true)
    assert.equal(await take('ip:a', 0), false)
    assert.equal((await db.query(`SELECT calls FROM public.ai_usage WHERE key='ip:a'`)).rows[0].calls, 4)
    assert.equal(await take('ip:w', 1, 1), true); assert.equal(await take('ip:w', 1, 1), false)
    await new Promise(r => setTimeout(r, 1100))
    assert.equal(await take('ip:w', 1, 1), true) // next window
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query(`SELECT public.consume_ai_quota('global','all',86400,10)`), /permission denied/)
    await assert.rejects(db.query('SELECT * FROM public.ai_usage'), /permission denied/)
    await db.exec('RESET ROLE; SET ROLE service_role')
    assert.equal((await db.query(`SELECT public.consume_ai_quota('global','all',86400,10) AS ok`)).rows[0].ok, true)
    await db.exec('RESET ROLE')
    await db.exec(rollback(sql('024')))
    assert.equal((await db.query(`SELECT to_regclass('public.ai_usage') AS t`)).rows[0].t, null)
  } finally { await db.close() }
})
