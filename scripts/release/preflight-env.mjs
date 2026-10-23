#!/usr/bin/env node
// MarkLens release preflight (R-2): checks an environment file for a target before deploying it.
//   vercel env pull .env.preview.local --environment=preview      (operator step)
//   node scripts/release/preflight-env.mjs .env.preview.local preview
//   node scripts/release/preflight-env.mjs .env.production.local production
// Prints variable NAMES and verdicts only — never a value. Exit code 1 when any check FAILs.
import { readFileSync } from "node:fs"
import { PRODUCTION_SUPABASE_REFS, databaseIsolated, supabaseRef } from "../../src/lib/release/guard.mjs"

const [file, target] = process.argv.slice(2)
if (!file || !["preview", "production"].includes(target)) {
  console.error("usage: node scripts/release/preflight-env.mjs <env-file> <preview|production>")
  process.exit(2)
}

/** @param {string} text */
function parseEnv(text) {
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2")
  }
  return env
}

const env = parseEnv(readFileSync(file, "utf8"))
const set = name => typeof env[name] === "string" && env[name].trim() !== ""
const host = name => { try { return new URL(env[name]).hostname } catch { return null } }
const results = []
const check = (level, name, ok, detail) => results.push({ level: ok ? "PASS" : level, name, detail })

// Every environment: the app cannot run, or its auth fails closed, without these.
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SITE_URL", "ADMIN_EMAIL", "CRON_SECRET", "N8N_WEBHOOK_SECRET"]) {
  check("FAIL", name, set(name), "필수 — 없으면 해당 기능이 거부·중단됩니다")
}
check("FAIL", "MARKLENS_DEPLOYMENT", target === "preview" || env.MARKLENS_DEPLOYMENT !== "preview", "Production 에 preview 강제값이 있으면 운영 기능이 모두 차단됩니다")
const ref = supabaseRef(env)
if (target === "preview") {
  check("FAIL", "NEXT_PUBLIC_SUPABASE_URL (isolation)", databaseIsolated(env), ref ? `프로젝트 ${ref}: ${PRODUCTION_SUPABASE_REFS.includes(ref) ? "운영 프로젝트와 같음" : "운영과 다름"}` : "<ref>.supabase.co 형식이 아니라 격리를 증명할 수 없음 — Preview 쓰기는 모두 차단됩니다")
  check("FAIL", "NEXT_PUBLIC_SITE_URL (host)", host("NEXT_PUBLIC_SITE_URL") !== "marklens.site" && host("NEXT_PUBLIC_SITE_URL") !== "www.marklens.site", "Preview 의 링크·OG·메일 주소가 운영 도메인을 가리키지 않아야 합니다")
  for (const name of ["IG_ACCESS_TOKEN", "IG_USER_ID", "THREADS_ACCESS_TOKEN", "THREADS_USER_ID", "BREVO_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "REMOTION_FUNCTION_NAME", "GA4_SA_PRIVATE_KEY"]) {
    check("WARN", name, !set(name), "운영 자격 증명 — 코드가 Preview 에서 차단하지만, Preview 환경에는 두지 않는 것을 권장")
  }
  check("WARN", "PREVIEW_ALLOW_AI", env.PREVIEW_ALLOW_AI !== "true", "true 이면 Preview 에서 유료 AI 호출이 허용됩니다(일일 한도는 적용)")
} else {
  check("WARN", "NEXT_PUBLIC_SUPABASE_URL (project)", !!ref && PRODUCTION_SUPABASE_REFS.includes(ref), ref ? `프로젝트 ${ref}` : "<ref>.supabase.co 형식이 아님")
  check("FAIL", "NEXT_PUBLIC_SITE_URL (host)", host("NEXT_PUBLIC_SITE_URL") === "marklens.site", "운영 URL 이 아니면 크론의 내부 호출·링크가 다른 곳을 가리킵니다")
  for (const name of ["BREVO_API_KEY", "GEMINI_API_KEY"]) check("WARN", name, set(name), "없으면 메일·AI 기능이 실패합니다")
  check("WARN", "PREVIEW_ALLOW_AI", !set("PREVIEW_ALLOW_AI"), "Production 에서는 의미 없는 값 — 제거 권장")
}

for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.name.padEnd(40)} ${r.level === "PASS" ? "" : r.detail}`)
const failed = results.filter(r => r.level === "FAIL").length, warned = results.filter(r => r.level === "WARN").length
console.log(`\n${target}: ${failed} FAIL, ${warned} WARN — ${failed ? "배포하지 마세요" : "차단 항목 없음"}`)
process.exit(failed ? 1 : 0)
