import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewInitFiles } from '../scripts/release/build-preview-sql.mjs'

// R-4 / migration 025: Insight Lab routes use the visitor's own session (anon / authenticated). 006 revoked every table
// grant, so 004's own-row policies never ran and every read and write failed (42501, reproduced on Preview). 025 grants
// exactly what the routes do; RLS keeps each member to their own rows. Real PostgreSQL (PGlite) with Supabase's roles and
// an auth.uid() that reads the request's JWT subject, as Supabase's does.
const require = createRequire(import.meta.url)
const A = '00000000-0000-4000-a000-00000000000a', B = '00000000-0000-4000-a000-00000000000b'
const STUBS = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean);`

async function database(upTo025) {
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  await db.exec(STUBS)
  for (const f of previewInitFiles()) if (upTo025 || !/02[56]_/.test(f)) await db.exec(readFileSync(f, 'utf8'))
  await db.exec(`INSERT INTO auth.users VALUES ('${A}', 'a@example.test'), ('${B}', 'b@example.test');
    INSERT INTO public.insight_challenges (title, summary, published_date, active) SELECT 'hidden draft', 's', current_date, false;`)
  return db
}
// Runs SQL as a role, optionally as a signed-in user; always returns to the superuser.
async function as(db, role, user, sql) {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  try { return await db.query(sql) } finally { await db.exec('RESET ROLE') }
}
const session = user => `INSERT INTO public.insight_sessions (user_id, step1_observation, step4_insight, step5_opportunity, xp_earned) VALUES ('${user}', 'o', 'i', 'p', 10) RETURNING id`

test('025 is needed: before it, members and visitors are refused everywhere (the Preview reproduction)', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database(false)
  try {
    for (const [role, user] of [['anon', null], ['authenticated', A]]) {
      for (const t of ['insight_challenges', 'insight_sessions', 'insight_notes', 'insight_user_stats']) await assert.rejects(as(db, role, user, `SELECT * FROM public.${t}`), /permission denied/, `${role} ${t}`)
    }
    await assert.rejects(as(db, 'authenticated', A, session(A)), /permission denied/)
  } finally { await db.close() }
})

test('025: members read and write only their own Insight Lab rows; visitors only see active challenges', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database(true)
  try {
    // Challenges: active ones for everybody, drafts for nobody but the service role.
    for (const [role, user] of [['anon', null], ['authenticated', A]]) {
      const titles = (await as(db, role, user, 'SELECT title FROM public.insight_challenges')).rows.map(r => r.title)
      assert.ok(titles.length > 0 && !titles.includes('hidden draft'), role)
      await assert.rejects(as(db, role, user, `UPDATE public.insight_challenges SET title = 'x'`), /permission denied/)
    }

    // Sessions: A saves and reads her own; cannot save as B; B never sees A's.
    assert.equal((await as(db, 'authenticated', A, session(A))).rows.length, 1)
    await assert.rejects(as(db, 'authenticated', A, session(B)), /row-level security/)
    assert.equal((await as(db, 'authenticated', A, 'SELECT user_id FROM public.insight_sessions')).rows.length, 1)
    assert.equal((await as(db, 'authenticated', B, 'SELECT user_id FROM public.insight_sessions')).rows.length, 0)
    await assert.rejects(as(db, 'authenticated', A, `DELETE FROM public.insight_sessions`), /permission denied/) // history is append-only

    // Notes: full own CRUD; another member's note can be neither changed nor removed.
    const note = (await as(db, 'authenticated', B, `INSERT INTO public.insight_notes (user_id, title) VALUES ('${B}', 'b note') RETURNING id`)).rows[0].id
    assert.equal((await as(db, 'authenticated', A, `UPDATE public.insight_notes SET title = 'hacked' WHERE id = '${note}'`)).affectedRows, 0)
    assert.equal((await as(db, 'authenticated', A, `DELETE FROM public.insight_notes WHERE id = '${note}'`)).affectedRows, 0)
    assert.equal((await db.query(`SELECT title FROM public.insight_notes WHERE id = '${note}'`)).rows[0].title, 'b note')
    assert.equal((await as(db, 'authenticated', B, `UPDATE public.insight_notes SET title = 'mine' WHERE id = '${note}'`)).affectedRows, 1)
    assert.equal((await as(db, 'authenticated', B, `DELETE FROM public.insight_notes WHERE id = '${note}'`)).affectedRows, 1)

    // Stats: own insert and update; never another member's.
    await as(db, 'authenticated', A, `INSERT INTO public.insight_user_stats (user_id, total_sessions, total_xp) VALUES ('${A}', 1, 10)`)
    await assert.rejects(as(db, 'authenticated', A, `INSERT INTO public.insight_user_stats (user_id, total_sessions, total_xp) VALUES ('${B}', 1, 999)`), /row-level security/)
    assert.equal((await as(db, 'authenticated', B, `UPDATE public.insight_user_stats SET total_xp = 0 WHERE user_id = '${A}'`)).affectedRows, 0)
    assert.equal((await as(db, 'authenticated', A, `UPDATE public.insight_user_stats SET total_xp = 20 WHERE user_id = '${A}'`)).affectedRows, 1)

    // Visitors: nothing on member tables; nobody signed in, nothing to own.
    for (const t of ['insight_sessions', 'insight_notes', 'insight_user_stats']) await assert.rejects(as(db, 'anon', null, `SELECT * FROM public.${t}`), /permission denied/, t)
    await assert.rejects(as(db, 'anon', null, session(A)), /permission denied/)

    // RLS stays on, and 025 refuses to run if it were ever turned off.
    await db.exec('ALTER TABLE public.insight_notes DISABLE ROW LEVEL SECURITY')
    await assert.rejects(db.exec(readFileSync('supabase/migrations/025_insight_lab_access.sql', 'utf8')), /row level security enabled/)
  } finally { await db.close() }
})

// The privileges the production audit (2026-10-25) found: every table privilege for authenticated on the three member
// tables, exactly 025's SELECT on challenges, nothing for anon on member tables.
const PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
const LAB = ['insight_challenges', 'insight_sessions', 'insight_notes', 'insight_user_stats']
const EXACT_025 = {
  'insight_challenges/anon': 'SELECT', 'insight_challenges/authenticated': 'SELECT',
  'insight_sessions/anon': '', 'insight_sessions/authenticated': 'SELECT,INSERT',
  'insight_notes/anon': '', 'insight_notes/authenticated': 'SELECT,INSERT,UPDATE,DELETE',
  'insight_user_stats/anon': '', 'insight_user_stats/authenticated': 'SELECT,INSERT,UPDATE',
}
async function privileges(db) {
  const out = {}
  for (const t of LAB) for (const r of ['anon', 'authenticated']) {
    const held = []
    for (const p of PRIVS) if ((await db.query(`SELECT has_table_privilege('${r}', 'public.${t}', '${p}') AS ok`)).rows[0].ok) held.push(p)
    out[`${t}/${r}`] = held.join(',')
  }
  return out
}

test('026: production\'s excess member privileges are reduced to exactly 025\'s, and the routes still work', { skip: !process.env.PGLITE_MODULE }, async () => {
  const db = await database(false)
  try {
    await db.exec(readFileSync('supabase/migrations/025_insight_lab_access.sql', 'utf8'))
    await db.exec('GRANT ALL ON public.insight_sessions, public.insight_notes, public.insight_user_stats TO authenticated') // = production today
    const before = await privileges(db)
    assert.equal(before['insight_notes/authenticated'], PRIVS.join(',')); assert.equal(before['insight_sessions/anon'], '')

    // While the extras exist, RLS is the only thing between a member and TRUNCATE (which RLS does not cover).
    await as(db, 'authenticated', A, session(A))
    await assert.doesNotReject(as(db, 'authenticated', B, 'TRUNCATE public.insight_sessions'))
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.insight_sessions')).rows[0].n, 0)

    const migration = readFileSync('supabase/migrations/026_insight_lab_least_privilege.sql', 'utf8')
    await db.exec(migration)
    assert.deepEqual(await privileges(db), EXACT_025)
    await db.exec(migration) // idempotent
    assert.deepEqual(await privileges(db), EXACT_025)

    // The extras are gone; every route operation still works for the owner and stays refused for others.
    await assert.rejects(as(db, 'authenticated', B, 'TRUNCATE public.insight_sessions'), /permission denied/)
    await assert.rejects(as(db, 'authenticated', A, `UPDATE public.insight_sessions SET xp_earned = 99`), /permission denied/)
    await assert.rejects(as(db, 'authenticated', A, `DELETE FROM public.insight_user_stats`), /permission denied/)
    assert.equal((await as(db, 'authenticated', A, session(A))).rows.length, 1)
    assert.equal((await as(db, 'authenticated', B, 'SELECT user_id FROM public.insight_sessions')).rows.length, 0)
    const note = (await as(db, 'authenticated', A, `INSERT INTO public.insight_notes (user_id, title) VALUES ('${A}', 'n') RETURNING id`)).rows[0].id
    assert.equal((await as(db, 'authenticated', A, `UPDATE public.insight_notes SET title = 'm' WHERE id = '${note}'`)).affectedRows, 1)
    assert.equal((await as(db, 'authenticated', B, `DELETE FROM public.insight_notes WHERE id = '${note}'`)).affectedRows, 0)
    assert.equal((await as(db, 'authenticated', A, `DELETE FROM public.insight_notes WHERE id = '${note}'`)).affectedRows, 1)
    await as(db, 'authenticated', A, `INSERT INTO public.insight_user_stats (user_id, total_sessions, total_xp) VALUES ('${A}', 1, 10)`)
    assert.equal((await as(db, 'authenticated', A, `UPDATE public.insight_user_stats SET total_xp = 20 WHERE user_id = '${A}'`)).affectedRows, 1)
    assert.ok((await as(db, 'anon', null, 'SELECT title FROM public.insight_challenges')).rows.length > 0)

    await db.exec('ALTER TABLE public.insight_notes DISABLE ROW LEVEL SECURITY')
    await assert.rejects(db.exec(migration), /row level security enabled/)
  } finally { await db.close() }
})

test('routes: every Insight Lab path uses the visitor session client, never the service role', () => {
  for (const f of ['src/app/api/insight-lab/challenge/route.ts', 'src/app/api/insight-lab/evaluate/route.ts', 'src/app/api/insight-lab/notes/route.ts', 'src/app/api/insight-lab/stats/route.ts', 'src/app/(public)/insight-lab/page.tsx']) {
    const src = readFileSync(f, 'utf8')
    assert.match(src, /createClient\(\)/, f); assert.doesNotMatch(src, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/, f)
  }
})
