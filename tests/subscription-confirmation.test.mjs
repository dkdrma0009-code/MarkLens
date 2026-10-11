import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import vm from "node:vm"
import { webcrypto } from "node:crypto"
import ts from "typescript"

// Optional isolated PostgreSQL runtime, installed outside the repository.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite node --test tests/subscription-confirmation.test.mjs
const require = createRequire(import.meta.url)
const sql = readFileSync("supabase/migrations/016_subscription_confirmation.sql", "utf8")
const email = "reader@example.test"
const tokenA = "a".repeat(64)
const tokenB = "b".repeat(64)

function loadRoute(file, db, delivery) {
  const exports = {}
  const logs = []
  const mail = {}
  vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/newsletter/confirmation-mail.mjs", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: mail, process: { env: { BREVO_API_KEY: "mock-only", NEXT_PUBLIC_SITE_URL: "https://marklens.site" } }, fetch: delivery })
  const mocks = {
    "@/lib/newsletter/confirmation-mail.mjs": mail,
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/rate-limit": { checkRateLimit: () => null },
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
  }
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    exports, require: name => { assert.ok(name in mocks); return mocks[name] },
    URL, Response, crypto: webcrypto, console: { error: msg => logs.push(msg) },
    process: { env: { BREVO_API_KEY: "mock-only", NEXT_PUBLIC_SITE_URL: "https://marklens.site" } },
    fetch: delivery,
  })
  return { ...exports, logs }
}

test("migration + actual PostgreSQL transitions", { skip: !process.env.PGLITE_MODULE }, async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE)
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.subscribers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
        status text NOT NULL DEFAULT 'active', subscribed_at timestamptz DEFAULT now(),
        unsubscribed_at timestamptz, source text);
      INSERT INTO public.subscribers(email,status) VALUES ('legacy@example.test','pending');`)
    await db.exec(sql)
    await db.exec(sql) // idempotent
    const issue = token => db.query("SELECT * FROM public.issue_subscription_confirmation($1,$2,$3)", [email, token, "homepage"])
    const confirm = token => db.query("SELECT * FROM public.confirm_subscription($1,$2)", [email, token])
    assert.equal((await db.query("SELECT * FROM public.confirm_subscription($1,$2)", ["legacy@example.test", "a".repeat(32)])).rows[0].result, "invalid_or_consumed")
    assert.deepEqual((await issue(tokenA)).rows, [{ result: "issued", subscription_created: true }])
    assert.equal((await db.query("SELECT confirmation_expires_at > now() + interval '47 hours' AS ttl FROM public.subscribers WHERE email=$1", [email])).rows[0].ttl, true)
    assert.equal((await confirm(tokenB)).rows[0].result, "invalid_or_consumed")
    assert.equal((await issue(tokenB)).rows[0].subscription_created, false)
    assert.equal((await confirm(tokenA)).rows[0].result, "invalid_or_consumed")
    await db.query("UPDATE public.subscribers SET confirmation_expires_at=now() WHERE email=$1", [email])
    assert.equal((await confirm(tokenB)).rows[0].result, "expired")
    await issue(tokenA)
    const duplicate = await Promise.all([confirm(tokenA), confirm(tokenA)])
    assert.deepEqual(duplicate.map(r => r.rows[0].result).sort(), ["confirmed", "invalid_or_consumed"])
    const row = (await db.query("SELECT status,confirmed_at,confirmation_token,confirmation_expires_at FROM public.subscribers WHERE email=$1", [email])).rows[0]
    assert.equal(row.status, "active")
    assert.ok(row.confirmed_at)
    assert.equal(row.confirmation_token, null)
    assert.equal(row.confirmation_expires_at, null)
    assert.equal((await confirm(tokenA)).rows[0].result, "invalid_or_consumed")
    assert.equal((await issue(tokenB)).rows[0].result, "already_active")
    assert.deepEqual((await db.query("SELECT status,confirmed_at,confirmation_token,confirmation_expires_at FROM public.subscribers WHERE email=$1", [email])).rows[0], row)
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("SELECT has_function_privilege($1,'public.confirm_subscription(text,text)','EXECUTE') AS allowed", [role])).rows[0].allowed, false)
    }
    assert.equal((await db.query("SELECT has_function_privilege('service_role','public.confirm_subscription(text,text)','EXECUTE') AS allowed")).rows[0].allowed, true)
    // Force an actual SQL update failure; transaction must leave pending/token intact.
    await db.exec(`UPDATE public.subscribers SET status='pending',confirmation_token='${tokenA}',confirmation_expires_at=now()+interval '48 hours' WHERE email='reader@example.test';
      CREATE FUNCTION public.reject_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.status='active' THEN RAISE EXCEPTION 'QA failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_activation BEFORE UPDATE ON public.subscribers FOR EACH ROW EXECUTE FUNCTION public.reject_activation();`)
    await assert.rejects(confirm(tokenA))
    assert.equal((await db.query("SELECT status FROM public.subscribers WHERE email=$1", [email])).rows[0].status, "pending")
  } finally { await db.close() }
})

test("actual confirmation handler: result states, failures, privacy, HEAD", async () => {
  for (const scenario of [
    { result: "confirmed", status: 200, mail: 1 },
    { result: "invalid_or_consumed", status: 400, mail: 0 },
    { result: "expired", status: 410, mail: 0 },
    { error: true, status: 500, mail: 0 },
    { empty: true, status: 500, mail: 0 },
    { multiple: true, status: 500, mail: 0 },
    { throws: true, status: 500, mail: 0 },
  ]) {
    let calls = 0, mail = 0
    const route = loadRoute("src/app/api/confirm-subscription/route.ts", {
      rpc: async (name, args) => {
        calls++; assert.equal(name, "confirm_subscription"); assert.equal(args.p_token, tokenA)
        if (scenario.throws) throw Error("mock private payload")
        return { data: scenario.empty ? [] : scenario.multiple ? [{ result: "confirmed" }, { result: "confirmed" }] : [{ result: scenario.result }], error: scenario.error ? { message: email + tokenA } : null }
      },
    }, async () => { mail++; return { ok: true } })
    const response = await route.GET(new Request(`https://marklens.site/api/confirm-subscription?email=${email}&token=${tokenA}`))
    assert.equal(response.status, scenario.status)
    assert.equal(mail, scenario.mail)
    const body = await response.text()
    assert.ok(!body.includes(email) && !body.includes(tokenA) && !body.includes("gtag"))
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer")
    assert.ok(!route.logs.join().includes(email) && !route.logs.join().includes(tokenA))
    await route.HEAD(); assert.equal(calls, 1)
    const malformed = await route.GET(new Request(`https://marklens.site/api/confirm-subscription?email=${email}&token=bad`))
    assert.equal(malformed.status, 400); assert.equal(calls, 1)
  }
})

test("actual signup handler: rotates secure tokens, preserves events and active rows", async () => {
  for (const scenario of [
    { result: "issued", created: true }, { result: "issued", created: false },
    { result: "already_active" }, { error: true }, { throws: true }, { result: "issued", emailFailed: true },
  ]) {
    const tokens = []; let mail = 0
    const route = loadRoute("src/app/api/subscribe/route.ts", {
      rpc: async (name, args) => {
        assert.equal(name, "issue_subscription_confirmation")
        assert.match(args.p_token, /^[a-f0-9]{64}$/); tokens.push(args.p_token)
        if (scenario.throws) throw Error("private mock payload")
        return { data: [{ result: scenario.result, subscription_created: scenario.created }], error: scenario.error ? {} : null }
      },
    }, async () => { mail++; return { ok: !scenario.emailFailed, text: async () => "mock" } })
    const submit = () => route.POST(new Request("https://marklens.site/api/subscribe", { method: "POST", body: JSON.stringify({ email, source: "homepage" }) }))
    const first = await submit(); const body = await first.json(); await submit()
    assert.notEqual(tokens[0], tokens[1])
    if (scenario.error || scenario.throws) { assert.equal(first.status, 500); assert.equal(mail, 0) }
    else if (scenario.result === "already_active") { assert.equal(body.alreadySubscribed, true); assert.equal(mail, 0) }
    else if (scenario.emailFailed) assert.equal(body.emailFailed, true)
    else assert.equal(body.subscriptionCreated, scenario.created)
    assert.ok(!JSON.stringify(body).includes(email) && !JSON.stringify(body).includes(tokens[0]))
  }
})
