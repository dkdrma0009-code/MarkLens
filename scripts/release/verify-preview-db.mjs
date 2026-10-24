#!/usr/bin/env node
// R-3: confirms that an env file's Supabase project IS the initialised Preview database — before any of its keys reach
// Vercel — and that each role sees only what it should. Against that project only; refuses a production or unprovable
// URL before sending anything.
//   node scripts/release/verify-preview-db.mjs .env.preview.local [--schema preview-schema.csv]
// Requests are GETs, except one: with ADMIN_PASSWORD in the env file it signs the test admin in (POST /auth/v1/token on
// the Preview project) to check the authenticated role. Without it those checks are UNKNOWN, never PASS.
// Whether a role may run a service-only function is probed with GET /rpc/<fn>: PostgREST runs GET in a read-only
// transaction, so a denied role gets "permission denied" (42501) and a permitted one a read-only error (25006) — nothing
// is ever written. Migrations that only add triggers (017, 022) are invisible over REST: --schema takes the bundle's
// final SQL check (23 rows) to confirm them; without it that item is UNKNOWN.
// Prints names, counts and verdicts — never a key, password, token or row value other than the environment marker.
// Exit code 0 all PASS, 1 any FAIL, 2 otherwise (something UNKNOWN).
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { parseEnv } from "./env-checks.mjs"
import { parseSchema } from "./preflight.mjs"
import { databaseIsolated, supabaseRef } from "../../src/lib/release/guard.mjs"

// Objects each migration leaves behind, as PostgREST exposes them to the service role (tables/columns, RPCs).
const EXPECTED = {
  tables: ["articles", "insights", "subscribers", "newsletter_issues", "newsletter_events", "insight_challenges", "insight_sessions", "content_metrics", "curations",
    "app_config", "cardnews", "feedback", "follower_snapshots", "quiz_questions", "site_feedback", "brand_entities", "brand_watch_profiles", "brand_takes", "ai_usage"],
  columns: { newsletter_issues: ["topic_headline", "approved_at"], subscribers: ["drip_step", "source", "confirmation_token"], cardnews: ["reel_settings", "ig_publish_state", "threads_publish_state"],
    insights: ["legacy_slug", "hook", "marketing_terms", "quiz", "video_url"], articles: ["site_published_at", "fallback_image"], brand_takes: ["confidence"] },
  // 022's brand_watch_mark_meaningful_update is a trigger function: PostgREST never exposes those (see --schema).
  rpcs: ["issue_subscription_confirmation", "brand_watch_approve_evidence", "brand_watch_publish_pattern", "consume_ai_quota", "random_quiz"],
  absent: ["competitions"],
  buckets: ["ad-assets", "ad-clips", "cardnews-ig", "stock-posters"],
}
// What anon and authenticated may read (RLS then limits rows to published content) and what they must not.
// Kept in step with the migrations by tests/preview-db.test.mjs (has_table_privilege on the built bundle).
export const PUBLIC_READ = ["articles", "categories", "insights", "newsletter_issues"]
export const ROLE_DENIED = ["subscribers", "app_config", "ai_usage", "cardnews", "feedback", "site_feedback", "follower_snapshots", "newsletter_events", "analytics_events",
  "quiz_questions", "content_metrics", "curations", "rss_sources", "brand_entities", "brand_evidence", "brand_takes", "brand_watch_profiles", "source_items"]
// Commands only the service role may run (paid AI quota, subscription tokens, Brand Watch review).
export const RPC_DENIED = ["consume_ai_quota", "issue_subscription_confirmation", "confirm_subscription", "recover_legacy_pending_subscription", "brand_watch_approve_evidence", "brand_watch_publish_pattern", "brand_watch_reject_evidence"]

/** @param {Record<string, string>} env @param {typeof fetch} fetchImpl @param {{ migration: string, present: boolean }[] | null} [schema] */
export async function verifyPreviewDb(env, fetchImpl = fetch, schema = null) {
  const results = []
  const add = (level, name, detail = "") => results.push({ level, name, detail })
  const check = (name, ok, detail = "") => add(ok ? "PASS" : "FAIL", name, detail)
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "")
  const service = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  check("Preview project (not production, provable)", databaseIsolated(env) && !!supabaseRef(env), supabaseRef(env) ? `ref ${supabaseRef(env)}` : "URL is not <ref>.supabase.co")
  if (env.MARKLENS_PREVIEW_REF) check("ref matches the expected Preview project", supabaseRef(env) === env.MARKLENS_PREVIEW_REF, `expected ${env.MARKLENS_PREVIEW_REF}`)
  check("anon and service_role keys present", !!service && !!anon)
  if (results.some(r => r.level === "FAIL")) return results // nothing is sent anywhere unless the target is provably Preview

  const request = async (method, path, key, { bearer = key, headers = {}, body } = {}) => {
    const res = await fetchImpl(url + path, { method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, ...headers, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    let json = null; try { json = await res.json() } catch { /* empty */ }
    return { status: res.status, body: json, range: res.headers.get("content-range") }
  }
  const get = (path, key, opts) => request("GET", path, key, opts)
  const count = async (table, key = service, bearer = key) => { const r = await get(`/rest/v1/${table}?select=*`, key, { bearer, headers: { Prefer: "count=exact", Range: "0-0" } }); return r.status < 300 ? Number(r.range?.split("/")[1]) : null }

  const marker = await get("/rest/v1/app_config?key=eq.marklens_environment&select=value", service)
  check("environment marker = preview (seeded by the Preview bundle)", Array.isArray(marker.body) && marker.body[0]?.value === "preview", `HTTP ${marker.status}`)

  const spec = await get("/rest/v1/", service, { headers: { Accept: "application/openapi+json" } })
  const defs = spec.body?.definitions ?? {}, paths = Object.keys(spec.body?.paths ?? {})
  const missingTables = EXPECTED.tables.filter(t => !defs[t])
  check("tables of migrations 001–024 and 001a", !missingTables.length, missingTables.join(", "))
  const missingColumns = Object.entries(EXPECTED.columns).flatMap(([t, cols]) => cols.filter(c => !defs[t]?.properties?.[c]).map(c => `${t}.${c}`))
  check("migration columns", !missingColumns.length, missingColumns.join(", "))
  const missingRpcs = EXPECTED.rpcs.filter(f => !paths.includes(`/rpc/${f}`))
  check("migration functions (RPC)", !missingRpcs.length, missingRpcs.join(", "))
  check("production parity: competitions dropped", EXPECTED.absent.every(t => !defs[t]))
  if (!schema) add("UNKNOWN", "trigger-only migrations 017, 022", "not visible over REST — pass --schema with the bundle's final SQL check")
  else {
    const missing = schema.filter(r => !r.present).map(r => r.migration)
    check("SQL check: all migrations present (incl. trigger-only 017, 022)", schema.length === 23 && !missing.length, missing.length ? `missing: ${missing.join(", ")}` : `${schema.length} rows`)
  }

  const counts = { articles: await count("articles"), insights: await count("insights"), quiz_questions: await count("quiz_questions"), subscribers: await count("subscribers") }
  check("synthetic seed only (3 articles, 3 insights, 2 quiz questions, 0 subscribers)", counts.articles === 3 && counts.insights === 3 && counts.quiz_questions === 2 && counts.subscribers === 0, JSON.stringify(counts))

  // Role access: what anon (and, when it can sign in, authenticated) may read, may not read, and may not execute.
  const roles = [["anon", anon]]
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const login = await request("POST", "/auth/v1/token?grant_type=password", anon, { body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD } })
    check("test admin signs in (Preview Auth)", login.status === 200 && !!login.body?.access_token, `HTTP ${login.status}`)
    if (login.body?.access_token) roles.push(["authenticated", login.body.access_token])
  } else add("UNKNOWN", "authenticated role", "ADMIN_EMAIL/ADMIN_PASSWORD not in env file — not checked")
  for (const [role, bearer] of roles) {
    const readable = []
    for (const t of PUBLIC_READ) if ((await count(t, anon, bearer)) === null) readable.push(t)
    check(`${role}: reads public tables (${PUBLIC_READ.join(", ")})`, !readable.length, readable.length ? `denied: ${readable.join(", ")}` : "")
    check(`${role}: published insights visible`, (await count("insights", anon, bearer)) === 3)
    const leaked = []
    for (const t of ROLE_DENIED) { const r = await get(`/rest/v1/${t}?select=*&limit=1`, anon, { bearer }); if (r.status < 300) leaked.push(t) }
    check(`${role}: denied on ${ROLE_DENIED.length} sensitive tables`, !leaked.length, leaked.length ? `READABLE: ${leaked.join(", ")}` : "")
    // GET /rpc/<fn> with the function's own argument names (from the service role's API description), read-only.
    const executable = [], unclear = []
    for (const f of RPC_DENIED) {
      const post = spec.body?.paths?.[`/rpc/${f}`]?.post
      const bodySchema = post?.parameters?.find(p => p.in === "body")?.schema
      const props = bodySchema?.properties ?? spec.body?.definitions?.[bodySchema?.$ref?.split("/").pop()]?.properties
      if (!props) { unclear.push(`${f} (not described)`); continue }
      const dummy = d => /int/.test(d.format ?? d.type) ? "1" : (d.format ?? d.type) === "boolean" ? "false" : d.format === "uuid" ? "00000000-0000-0000-0000-000000000000" : /time|date/.test(d.format ?? "") ? "2000-01-01" : "x"
      const query = Object.entries(props).map(([n, d]) => `${n}=${encodeURIComponent(dummy(d))}`).join("&")
      const r = await get(`/rest/v1/rpc/${f}?${query}`, anon, { bearer })
      if (r.body?.code === "42501") continue // permission denied for function — as required
      if (r.status < 300 || r.body?.code === "25006") executable.push(f) // ran (stopped only by the read-only transaction)
      else unclear.push(`${f} (HTTP ${r.status} ${r.body?.code ?? ""})`)
    }
    if (executable.length) check(`${role}: service-only commands not executable`, false, `EXECUTABLE: ${executable.join(", ")}`)
    else if (unclear.length) add("UNKNOWN", `${role}: service-only commands not executable`, unclear.join("; "))
    else check(`${role}: service-only commands not executable`, true, `${RPC_DENIED.length} denied`)
  }

  const buckets = await get("/storage/v1/bucket", service)
  const have = new Map((Array.isArray(buckets.body) ? buckets.body : []).map(b => [b.id, b.public]))
  const badBuckets = EXPECTED.buckets.filter(b => have.get(b) !== true)
  check("storage buckets (4, public)", !badBuckets.length, badBuckets.length ? `missing or private: ${badBuckets.join(", ")}` : "")
  const anonBuckets = await get("/storage/v1/bucket", anon)
  check("anon cannot list buckets", anonBuckets.status >= 400 || (Array.isArray(anonBuckets.body) && anonBuckets.body.length === 0), `HTTP ${anonBuckets.status}`)

  const users = await get("/auth/v1/admin/users?per_page=50", service)
  const list = users.body?.users ?? []
  const admin = (env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  check("test admin user exists in Preview Auth", !!admin && list.some(u => (u.email ?? "").toLowerCase() === admin), `${list.length} user(s)${admin ? "" : " — ADMIN_EMAIL not in env file"}`)
  return results
}

async function main(argv) {
  const file = argv[0], schemaAt = argv.indexOf("--schema")
  if (!file || file.startsWith("--")) { console.error("usage: node scripts/release/verify-preview-db.mjs <env-file> [--schema <check.csv>]"); process.exit(64) }
  const schema = schemaAt > 0 ? parseSchema(readFileSync(argv[schemaAt + 1], "utf8")) : null
  const results = await verifyPreviewDb(parseEnv(readFileSync(file, "utf8")), fetch, schema)
  for (const r of results) console.log(`${r.level.padEnd(7)} ${r.name.padEnd(76)} ${r.detail}`)
  const failed = results.filter(r => r.level === "FAIL").length, unknown = results.filter(r => r.level === "UNKNOWN").length
  console.log(`\n${failed ? `${failed} FAIL` : unknown ? `${unknown} UNKNOWN — not verified` : "Preview database verified"}`)
  process.exit(failed ? 1 : unknown ? 2 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
