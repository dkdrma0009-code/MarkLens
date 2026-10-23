// Release guard (R-2): a Preview deployment must never change production data or reach the outside world on
// production's behalf. Production and local runs are untouched; every Preview check fails closed.
//
// Deployment: VERCEL_ENV=production → production. Any other Vercel deployment (VERCEL_ENV preview/development, or
// VERCEL set without a recognised VERCEL_ENV) → preview. MARKLENS_DEPLOYMENT=preview opts any host into the guards
// (local QA). Otherwise → local.
// A Preview may write to Supabase only when NEXT_PUBLIC_SUPABASE_URL is a <ref>.supabase.co project that is not a known
// production project. Publishing, mail, AWS rendering/deletion and crons are always refused in Preview; paid AI only
// with PREVIEW_ALLOW_AI=true.

/** Production Supabase project refs (a public project id, documented in supabase/migrations/README.md; not a secret). */
export const PRODUCTION_SUPABASE_REFS = ["ndehtnchkgvpjbxlkazk"]

/** @typedef {"db-write" | "instagram" | "threads" | "email" | "aws" | "ai" | "cron"} GuardedAction */
/** @typedef {"production" | "preview" | "local"} Deployment */
/** @typedef {Record<string, string | undefined>} Env */

const LABEL = { "db-write": "DB 쓰기", instagram: "Instagram 게시", threads: "Threads 게시", email: "이메일 발송", aws: "AWS 렌더·저장소 변경", ai: "유료 AI 호출", cron: "예약 작업(Cron)" }

/** @param {Env} [env] @returns {Deployment} */
export function deployment(env = process.env) {
  if (env.MARKLENS_DEPLOYMENT === "preview") return "preview"
  if (env.VERCEL_ENV === "production") return "production"
  if (env.VERCEL_ENV || env.VERCEL) return "preview"
  return "local"
}

/** @param {Env} [env] @returns {string | null} */
export function supabaseRef(env = process.env) {
  try {
    const host = new URL((env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace("﻿", "").trim()).hostname
    return /^([a-z0-9]{15,30})\.supabase\.co$/.exec(host)?.[1] ?? null
  } catch {
    return null
  }
}

/** True only when the database is provably not a production project. @param {Env} [env] */
export function databaseIsolated(env = process.env) {
  const ref = supabaseRef(env)
  const production = [...PRODUCTION_SUPABASE_REFS, ...(env.MARKLENS_PRODUCTION_SUPABASE_REFS ?? "").split(",").map(s => s.trim()).filter(Boolean)]
  return !!ref && !production.includes(ref)
}

/** Why this action is refused here, or null when it may run. @param {GuardedAction} action @param {Env} [env] */
export function blockedReason(action, env = process.env) {
  if (deployment(env) !== "preview") return null
  if (action === "db-write") return databaseIsolated(env) ? null : "Preview 환경: 운영 DB일 수 있는 Supabase에는 쓰지 않습니다(격리된 Preview DB 필요)."
  if (action === "ai") return env.PREVIEW_ALLOW_AI === "true" ? null : "Preview 환경: 유료 AI 호출이 차단되어 있습니다(PREVIEW_ALLOW_AI 미설정)."
  return `Preview 환경: ${LABEL[action]}이(가) 차단되어 있습니다.`
}

export class ReleaseGuardError extends Error {
  /** @param {GuardedAction} action @param {string} reason */
  constructor(action, reason) {
    super(reason)
    this.name = "ReleaseGuardError"
    this.action = action
    this.status = 403
  }
}

/** Throws ReleaseGuardError when the action is refused here. @param {GuardedAction} action @param {Env} [env] */
export function assertAllowed(action, env = process.env) {
  const reason = blockedReason(action, env)
  if (reason) throw new ReleaseGuardError(action, reason)
}

// Outbound hosts with side effects or cost. Read-only GETs to Instagram/Threads (metrics) and Brevo (account health)
// stay allowed; a token refresh is a GET that rotates the token, so it is listed explicitly.
const EGRESS = [
  { action: "email", host: "api.brevo.com", methods: ["POST", "PUT", "PATCH", "DELETE"] },
  { action: "instagram", host: "graph.instagram.com", methods: ["POST", "DELETE"], paths: [/refresh_access_token/] },
  { action: "threads", host: "graph.threads.net", methods: ["POST", "DELETE"], paths: [/refresh_access_token/] },
  { action: "ai", host: "generativelanguage.googleapis.com" },
  { action: "ai", host: "api.anthropic.com" },
  { action: "ai", host: "api.openai.com" },
]

/** The guarded action an outbound request would perform, or null. @param {string} url @param {string} [method] */
export function egressAction(url, method = "GET") {
  let parsed
  try { parsed = new URL(url) } catch { return null }
  const rule = EGRESS.find(r => parsed.hostname === r.host)
  if (!rule) return null
  if (!rule.methods || rule.methods.includes(method.toUpperCase())) return rule.action
  return rule.paths?.some(p => p.test(parsed.pathname + parsed.search)) ? rule.action : null
}

/** Wraps fetch so a Preview cannot reach side-effect or paid hosts even from a call site without its own check.
 *  @param {typeof fetch} fetchImpl @param {Env} [env] @returns {typeof fetch} */
export function guardFetch(fetchImpl, env = process.env) {
  if (deployment(env) !== "preview") return fetchImpl
  return function guardedFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
    const action = egressAction(url, method)
    const reason = action && blockedReason(action, env)
    if (reason) return Promise.reject(new ReleaseGuardError(/** @type {GuardedAction} */ (action), reason))
    return fetchImpl(input, init)
  }
}
