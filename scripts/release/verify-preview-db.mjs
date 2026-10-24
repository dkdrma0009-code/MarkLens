#!/usr/bin/env node
// R-3: confirms that an env file's Supabase project IS the initialised Preview database — before any of its keys reach
// Vercel. READ ONLY (GET requests only), against that project only; refuses a production or unprovable URL first.
//   node scripts/release/verify-preview-db.mjs .env.preview.local
// Prints names, counts and verdicts — never a key or a row value other than the environment marker.
// Exit code 0 when every check passes, 1 otherwise.
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { parseEnv } from "./env-checks.mjs"
import { databaseIsolated, supabaseRef } from "../../src/lib/release/guard.mjs"

// Objects each migration leaves behind, as PostgREST exposes them to the service role (tables/columns, RPCs).
const EXPECTED = {
  tables: ["articles", "insights", "subscribers", "newsletter_issues", "newsletter_events", "insight_challenges", "insight_sessions", "content_metrics", "curations",
    "app_config", "cardnews", "feedback", "follower_snapshots", "quiz_questions", "site_feedback", "brand_entities", "brand_watch_profiles", "brand_takes", "ai_usage"],
  columns: { newsletter_issues: ["topic_headline", "approved_at"], subscribers: ["drip_step", "source", "confirmation_token"], cardnews: ["reel_settings", "ig_publish_state", "threads_publish_state"],
    insights: ["legacy_slug", "hook", "marketing_terms", "quiz", "video_url"], articles: ["site_published_at", "fallback_image"], brand_takes: ["confidence"] },
  rpcs: ["issue_subscription_confirmation", "brand_watch_approve_evidence", "brand_watch_publish_pattern", "brand_watch_mark_meaningful_update", "consume_ai_quota", "random_quiz"],
  absent: ["competitions"],
  buckets: ["ad-assets", "ad-clips", "cardnews-ig", "stock-posters"],
}

/** @param {Record<string, string>} env @param {typeof fetch} fetchImpl */
export async function verifyPreviewDb(env, fetchImpl = fetch) {
  const results = []
  const check = (name, ok, detail = "") => results.push({ level: ok ? "PASS" : "FAIL", name, detail })
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "")
  const service = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  check("Preview project (not production, provable)", databaseIsolated(env) && !!supabaseRef(env), supabaseRef(env) ? `ref ${supabaseRef(env)}` : "URL is not <ref>.supabase.co")
  check("anon and service_role keys present", !!service && !!anon)
  if (results.some(r => r.level === "FAIL")) return results // nothing is sent anywhere unless the target is provably Preview

  const get = async (path, key, extra = {}) => {
    const res = await fetchImpl(url + path, { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, ...extra } })
    let body = null; try { body = await res.json() } catch { /* empty */ }
    return { status: res.status, body, range: res.headers.get("content-range") }
  }
  const count = async (table, key = service) => { const r = await get(`/rest/v1/${table}?select=*`, key, { Prefer: "count=exact", Range: "0-0" }); return r.status < 300 ? Number(r.range?.split("/")[1]) : null }

  const marker = await get("/rest/v1/app_config?key=eq.marklens_environment&select=value", service)
  check("environment marker = preview (seeded by the Preview bundle)", Array.isArray(marker.body) && marker.body[0]?.value === "preview", `HTTP ${marker.status}`)

  const spec = await get("/rest/v1/", service, { Accept: "application/openapi+json" })
  const defs = spec.body?.definitions ?? {}, paths = Object.keys(spec.body?.paths ?? {})
  const missingTables = EXPECTED.tables.filter(t => !defs[t])
  check("tables of migrations 001–024 and 001a", !missingTables.length, missingTables.join(", "))
  const missingColumns = Object.entries(EXPECTED.columns).flatMap(([t, cols]) => cols.filter(c => !defs[t]?.properties?.[c]).map(c => `${t}.${c}`))
  check("migration columns", !missingColumns.length, missingColumns.join(", "))
  const missingRpcs = EXPECTED.rpcs.filter(f => !paths.includes(`/rpc/${f}`))
  check("migration functions (RPC)", !missingRpcs.length, missingRpcs.join(", "))
  check("production parity: competitions dropped", EXPECTED.absent.every(t => !defs[t]))

  const counts = { articles: await count("articles"), insights: await count("insights"), quiz_questions: await count("quiz_questions"), subscribers: await count("subscribers") }
  check("synthetic seed only (3 articles, 3 insights, 2 quiz questions, 0 subscribers)", counts.articles === 3 && counts.insights === 3 && counts.quiz_questions === 2 && counts.subscribers === 0, JSON.stringify(counts))

  const anonSubscribers = await get("/rest/v1/subscribers?select=email&limit=1", anon)
  check("anon cannot read subscribers (006)", anonSubscribers.status === 401 || anonSubscribers.status === 403 || anonSubscribers.body?.code === "42501", `HTTP ${anonSubscribers.status}`)
  const anonInsights = await count("insights", anon)
  check("anon reads published insights", anonInsights === 3, String(anonInsights))

  const buckets = await get("/storage/v1/bucket", service)
  const have = new Map((Array.isArray(buckets.body) ? buckets.body : []).map(b => [b.id, b.public]))
  const badBuckets = EXPECTED.buckets.filter(b => have.get(b) !== true)
  check("storage buckets (4, public)", !badBuckets.length, badBuckets.length ? `missing or private: ${badBuckets.join(", ")}` : "")

  const users = await get("/auth/v1/admin/users?per_page=50", service)
  const list = users.body?.users ?? []
  const admin = (env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  check("test admin user exists in Preview Auth", !!admin && list.some(u => (u.email ?? "").toLowerCase() === admin), `${list.length} user(s)${admin ? "" : " — ADMIN_EMAIL not in env file"}`)
  return results
}

async function main([file]) {
  if (!file) { console.error("usage: node scripts/release/verify-preview-db.mjs <env-file>"); process.exit(64) }
  const results = await verifyPreviewDb(parseEnv(readFileSync(file, "utf8")))
  for (const r of results) console.log(`${r.level}  ${r.name.padEnd(76)} ${r.detail}`)
  const failed = results.filter(r => r.level === "FAIL").length
  console.log(`\n${failed ? `${failed} FAIL` : "Preview database verified"}`)
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
