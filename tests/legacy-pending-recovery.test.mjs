import assert from "node:assert/strict"
import { test } from "node:test"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { recoverLegacyPending } from "../src/lib/newsletter/legacy-recovery.mjs"

const require = createRequire(import.meta.url)
const candidate = row => row.status === "pending" && row.confirmation_token === null && row.confirmation_expires_at === null && row.confirmed_at === null
function mockDb(rows, { releaseError = false } = {}) {
  const calls = []
  return {
    calls,
    from() {
      let head = false, limit = Infinity
      const filters = []
      const query = {
        select(_columns, opts) { head = opts?.head; return this },
        eq(k, v) { filters.push([k, v]); return this },
        is(k, v) { filters.push([k, v]); return this },
        limit(n) { limit = n; return this },
        then(resolve) {
          assert.deepEqual(filters, [["status", "pending"], ["confirmation_token", null], ["confirmation_expires_at", null], ["confirmed_at", null]])
          const matches = rows.filter(candidate)
          return Promise.resolve(head ? { count: matches.length } : { data: matches.slice(0, limit).map(row => ({ id: row.id })) }).then(resolve)
        },
      }
      return query
    },
    async rpc(name, { p_id, p_token }) {
      calls.push(name)
      const row = rows.find(row => row.id === p_id)
      if (name === "recover_legacy_pending_subscription") {
        if (!candidate(row)) return { data: [] }
        assert.match(p_token, /^[a-f0-9]{64}$/)
        row.confirmation_token = p_token; row.confirmation_expires_at = new Date(Date.now() + 48 * 3600000).toISOString()
        return { data: [{ email: row.email }] }
      }
      assert.equal(name, "release_legacy_pending_recovery")
      if (releaseError) return { error: { message: "private data must not be logged" } }
      if (row.status !== "pending" || row.confirmation_token !== p_token || row.confirmed_at !== null) return { data: [] }
      row.confirmation_token = null; row.confirmation_expires_at = null
      return { data: [{ released: true }] }
    },
  }
}
function fixtures() {
  const row = (id, status) => ({ id, status, email: `${id}@example.test`, confirmation_token: null, confirmation_expires_at: null, confirmed_at: null })
  return [row("legacy-a", "pending"), row("legacy-b", "pending"), row("active", "active"), { ...row("new", "pending"), confirmation_token: "c".repeat(64), confirmation_expires_at: "2099-01-01" }, { ...row("reconfirmed", "pending"), confirmed_at: "2026-10-01" }]
}

test("dry run → recovery → zero candidates; excludes active/new/reconfirmed, no repeated mail", async () => {
  const rows = fixtures(), db = mockDb(rows), unchanged = structuredClone(rows.slice(2)), sent = []
  const sendEmail = async (email, url) => { sent.push(email); const u = new URL(url); assert.equal(u.pathname, "/api/confirm-subscription"); assert.match(u.searchParams.get("token"), /^[a-f0-9]{64}$/) }
  assert.equal((await recoverLegacyPending({ db, sendEmail })).candidates, 2)
  assert.equal(db.calls.length, 0); assert.equal(sent.length, 0)
  await assert.rejects(recoverLegacyPending({ db, execute: true, expectedCount: 3, sendEmail }))
  assert.equal(db.calls.length, 0)
  const result = await recoverLegacyPending({ db, execute: true, expectedCount: 2, sendEmail })
  assert.deepEqual(result, { candidates: 2, success: 2, failure: 0, skipped: 0, retryBlocked: 0 })
  for (const row of rows.slice(0, 2)) { assert.equal(row.status, "pending"); assert.equal(row.confirmed_at, null); assert.ok(new Date(row.confirmation_expires_at) > new Date()) }
  assert.deepEqual(rows.slice(2), unchanged)
  assert.equal((await recoverLegacyPending({ db, sendEmail })).candidates, 0)
  assert.equal((await recoverLegacyPending({ db, execute: true, expectedCount: 0, sendEmail })).success, 0)
  assert.equal(sent.length, 2)
})

test("email failure releases only matching claim; rerun works, newer token/active protected", async () => {
  const rows = fixtures().slice(0, 1), db = mockDb(rows)
  const failure = await recoverLegacyPending({ db, execute: true, expectedCount: 1, sendEmail: async () => { throw Error("private provider payload") } })
  assert.equal(failure.failure, 1); assert.ok(candidate(rows[0]))
  assert.equal((await recoverLegacyPending({ db, execute: true, expectedCount: 1, sendEmail: async () => {} })).success, 1)
  for (const change of [row => { row.status = "active"; row.confirmed_at = "2026-10-11" }, row => { row.confirmation_token = "d".repeat(64) }]) {
    const r = fixtures().slice(0, 1), db = mockDb(r)
    await recoverLegacyPending({ db, execute: true, expectedCount: 1, sendEmail: async () => { change(r[0]); throw Error("mock") } })
    assert.ok(r[0].confirmation_token); assert.equal(candidate(r[0]), false)
  }
  const blocked = await recoverLegacyPending({ db: mockDb(fixtures().slice(0, 1), { releaseError: true }), execute: true, expectedCount: 1, sendEmail: async () => { throw Error("mock") } })
  assert.equal(blocked.retryBlocked, 1)
  const unknown = mockDb(fixtures().slice(0, 1))
  unknown.rpc = async () => { throw Error("private RPC payload") }
  const uncertain = await recoverLegacyPending({ db: unknown, execute: true, expectedCount: 1, sendEmail: async () => { assert.fail("No email on unknown claim") } })
  assert.equal(uncertain.failure, 1); assert.equal(uncertain.retryBlocked, 1)
})

test("duplicate recovery invocations have one claim and one email per candidate", async () => {
  const rows = fixtures().slice(0, 2), db = mockDb(rows); let sent = 0
  const results = await Promise.all([1, 2].map(() => recoverLegacyPending({ db, execute: true, expectedCount: 2, sendEmail: async () => { sent++ } })))
  assert.equal(sent, 2); assert.equal(results.reduce((n, r) => n + r.success, 0), 2)
})

test("CLI default is read-only count; invalid execute flags abort without DB calls or PII output", async () => {
  const methods = []
  const server = createServer((req, res) => { methods.push(req.method); assert.match(req.url, /confirmation_token=is.null/); res.setHeader("content-range", "*/2"); res.end() })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  try {
    const run = args => new Promise(resolve => {
      const child = spawn(process.execPath, ["scripts/recover-legacy-pending-subscribers.mjs", ...args], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: "mock-only" } })
      let output = ""; child.stdout.on("data", b => { output += b }); child.stderr.on("data", b => { output += b }); child.on("close", code => resolve({ code, output }))
    })
    const dry = await run([])
    assert.equal(dry.code, 0); assert.match(dry.output, /Mode: DRY RUN/); assert.match(dry.output, /Legacy pending candidates: 2/)
    for (const args of [["--execute"], ["--execute", "--expect-count", "bad"], ["--unknown"]]) assert.equal((await run(args)).code, 1)
    assert.deepEqual(methods, ["HEAD"]); assert.ok(!dry.output.includes("@") && !dry.output.includes("mock-only"))
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test("actual recovery SQL claims once, protects race, and new token confirms", { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.subscribers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text UNIQUE NOT NULL,status text NOT NULL,subscribed_at timestamptz,source text);
      INSERT INTO public.subscribers(email,status) VALUES ('legacy@example.test','pending'),('active@example.test','active');`)
    await db.exec(readFileSync("supabase/migrations/016_subscription_confirmation.sql", "utf8"))
    const rows = (await db.query("SELECT id,status FROM public.subscribers")).rows
    const legacy = rows.find(r => r.status === "pending").id, active = rows.find(r => r.status === "active").id
    const claim = (id, token) => db.query("SELECT * FROM public.recover_legacy_pending_subscription($1,$2)", [id, token])
    const tokenA = "a".repeat(64), tokenB = "b".repeat(64)
    assert.equal((await claim(active, tokenA)).rows.length, 0)
    const duplicate = await Promise.all([claim(legacy, tokenA), claim(legacy, tokenB)])
    assert.equal(duplicate.reduce((n, r) => n + r.rows.length, 0), 1)
    const row = (await db.query("SELECT * FROM public.subscribers WHERE id=$1", [legacy])).rows[0]
    assert.equal(row.status, "pending"); assert.equal(row.confirmed_at, null)
    assert.ok(new Date(row.confirmation_expires_at) > new Date(Date.now() + 47 * 3600000))
    assert.equal((await claim(legacy, tokenB)).rows.length, 0)
    assert.equal((await db.query("SELECT * FROM public.release_legacy_pending_recovery($1,$2)", [legacy, tokenB])).rows.length, 0)
    await db.query("SELECT * FROM public.release_legacy_pending_recovery($1,$2)", [legacy, tokenA])
    assert.equal((await claim(legacy, tokenB)).rows.length, 1)
    assert.equal((await db.query("SELECT * FROM public.confirm_subscription($1,$2)", ["legacy@example.test", tokenB])).rows[0].result, "confirmed")
    assert.equal((await claim(legacy, tokenA)).rows.length, 0)
    assert.equal((await db.query("SELECT * FROM public.release_legacy_pending_recovery($1,$2)", [legacy, tokenB])).rows.length, 0)
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("SELECT has_function_privilege($1,'public.recover_legacy_pending_subscription(uuid,text)','EXECUTE') AS allowed", [role])).rows[0].allowed, false)
      assert.equal((await db.query("SELECT has_function_privilege($1,'public.release_legacy_pending_recovery(uuid,text)','EXECUTE') AS allowed", [role])).rows[0].allowed, false)
    }
  } finally { await db.close() }
})
