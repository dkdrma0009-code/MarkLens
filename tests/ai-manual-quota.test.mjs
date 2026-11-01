import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

test('real quota SQL admits only five shared admin attempts under competing requests', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required')
  const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
    await db.exec(readFileSync('supabase/migrations/024_ai_usage_quota.sql', 'utf8'))
    const results = await Promise.all(Array.from({ length: 32 }, () => db.query(
      "SELECT public.consume_ai_quota('manual-ai', 'all-admins', 86400, 5) AS allowed",
    )))
    assert.equal(results.filter(result => result.rows[0].allowed).length, 5)
    const { rows } = await db.query('SELECT calls FROM public.ai_usage')
    assert.deepEqual(rows, [{ calls: 5 }])
    await db.exec('SET ROLE authenticated')
    await assert.rejects(db.query("SELECT public.consume_ai_quota('manual-ai', 'all-admins', 86400, 5)"), /permission denied/)
  } finally {
    await db.close()
  }
})
