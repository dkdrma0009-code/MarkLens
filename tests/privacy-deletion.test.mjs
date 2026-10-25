import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewInitFiles } from '../scripts/release/build-preview-sql.mjs'

// R-4 privacy: the operator's deletion SQL (scripts/release/privacy-deletion.sql) removes exactly the person or the
// expired records it names, on the real schema (PGlite), and leaves everything else. Retention days stay placeholders.
const require = createRequire(import.meta.url)
const U1 = '00000000-0000-4000-a000-0000000000a1', U2 = '00000000-0000-4000-a000-0000000000a2'
const STUBS = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon' $$;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean);`
const sql = readFileSync('scripts/release/privacy-deletion.sql', 'utf8')
const section = tag => sql.slice(sql.indexOf(`-- [${tag}]`), ['A', 'B', 'C'].map(t => sql.indexOf(`-- [${t}]`)).filter(i => i > sql.indexOf(`-- [${tag}]`)).sort((a, b) => a - b)[0] ?? sql.length)
const fill = (text, values) => { const out = text.replace(/\{\{(\w+)\}\}/g, (_, k) => { assert.ok(k in values, k); return values[k] }); assert.doesNotMatch(out, /\{\{/); return out }
const ago = days => `now() - interval '${days} days'`

async function database() {
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  await db.exec(STUBS)
  for (const f of previewInitFiles()) await db.exec(readFileSync(f, 'utf8'))
  await db.exec(`
    DELETE FROM public.subscribers;
    INSERT INTO public.subscribers (email, status, subscribed_at, unsubscribed_at, confirmed_at) VALUES
      ('a@x.test', 'active', ${ago(300)}, NULL, ${ago(300)}),
      ('b@x.test', 'unsubscribed', ${ago(400)}, ${ago(100)}, ${ago(400)}),
      ('c@x.test', 'unsubscribed', ${ago(50)}, ${ago(5)}, ${ago(50)}),
      ('d@x.test', 'pending', ${ago(40)}, NULL, NULL),
      ('e@x.test', 'pending', ${ago(2)}, NULL, NULL);
    INSERT INTO public.newsletter_events (email, event, created_at) VALUES
      ('a@x.test', 'opened', ${ago(1)}), ('a@x.test', 'delivered', ${ago(200)}), ('c@x.test', 'opened', ${ago(1)}), ('gone@x.test', 'opened', ${ago(1)});
    INSERT INTO auth.users VALUES ('${U1}', 'u1@x.test'), ('${U2}', 'u2@x.test');
    INSERT INTO public.insight_notes (user_id, title) VALUES ('${U1}', 'n1'), ('${U2}', 'n2');
    INSERT INTO public.ai_usage (scope, key, window_start, calls) VALUES
      ('feature:chat', 'user:${U1}', ${ago(1)}, 3), ('feature:chat', 'user:${U2}', ${ago(1)}, 1),
      ('feature:chat', 'ip:old', ${ago(100)}, 2), ('feature:chat', 'ip:new', ${ago(1)}, 2);
    INSERT INTO public.feedback (rating, created_at) VALUES ('helpful', ${ago(400)}), ('helpful', ${ago(10)});`)
  return db
}
const col = async (db, q) => (await db.query(q)).rows.map(r => Object.values(r)[0])

test('the deletion SQL keeps retention periods as placeholders for the operator, never invented numbers', () => {
  for (const k of ['EMAIL', 'USER_ID', 'UNSUBSCRIBED_DAYS', 'UNCONFIRMED_DAYS', 'EVENT_DAYS', 'AI_USAGE_DAYS', 'FEEDBACK_DAYS']) assert.match(sql, new RegExp(`\\{\\{${k}\\}\\}`), k)
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /interval '\d+/)
})

test('[A] a subscriber request removes that address (any case) and its newsletter events, nothing else', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database()
  try {
    await db.exec(fill(section('A'), { EMAIL: 'A@X.TEST' }))
    assert.deepEqual(await col(db, 'SELECT email FROM public.subscribers ORDER BY email'), ['b@x.test', 'c@x.test', 'd@x.test', 'e@x.test'])
    assert.deepEqual(await col(db, 'SELECT email FROM public.newsletter_events ORDER BY email'), ['c@x.test', 'gone@x.test'])
  } finally { await db.close() }
})

test('[B] a member request: the account deletion cascades Insight Lab rows; the SQL removes only their AI counters', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database()
  try {
    await db.exec(`DELETE FROM auth.users WHERE id = '${U1}'`) // = Supabase -> Authentication -> Users -> Delete
    assert.deepEqual(await col(db, 'SELECT title FROM public.insight_notes'), ['n2'])
    await db.exec(fill(section('B'), { USER_ID: U1 }))
    assert.deepEqual(await col(db, 'SELECT key FROM public.ai_usage ORDER BY key'), ['ip:new', 'ip:old', `user:${U2}`])
  } finally { await db.close() }
})

test('[C] monthly purge deletes only what is past the stated periods, plus events of addresses no longer subscribed', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database()
  try {
    await db.exec(fill(section('C'), { UNSUBSCRIBED_DAYS: '30', UNCONFIRMED_DAYS: '30', EVENT_DAYS: '180', AI_USAGE_DAYS: '30', FEEDBACK_DAYS: '365' }))
    assert.deepEqual(await col(db, 'SELECT email FROM public.subscribers ORDER BY email'), ['a@x.test', 'c@x.test', 'e@x.test'])
    assert.deepEqual(await col(db, `SELECT email || ':' || event FROM public.newsletter_events ORDER BY 1`), ['a@x.test:opened', 'c@x.test:opened'])
    assert.deepEqual(await col(db, 'SELECT key FROM public.ai_usage ORDER BY key'), ['ip:new', `user:${U1}`, `user:${U2}`])
    assert.equal((await col(db, 'SELECT count(*)::int FROM public.feedback'))[0], 1)
  } finally { await db.close() }
})
