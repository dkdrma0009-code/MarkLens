// Environment checks shared by preflight-env.mjs and preflight.mjs (R-2, R-3). Names and verdicts only — never a value.
import { PRODUCTION_SUPABASE_REFS, databaseIsolated, supabaseRef } from "../../src/lib/release/guard.mjs"

/** @param {string} text */
export function parseEnv(text) {
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2")
  }
  return env
}

/** @param {Record<string, string>} env @param {"preview" | "production"} target @returns {{ level: "PASS" | "FAIL" | "WARN", name: string, detail: string }[]} */
export function envChecks(env, target) {
  // "disabled-in-preview" is the inert value a branch-scoped Preview variable uses to shadow a credential inherited from
  // every Preview (docs/release/preview-runbook.md); it counts as not set.
  const set = name => typeof env[name] === "string" && env[name].trim() !== "" && env[name].trim() !== "disabled-in-preview"
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
    // Preview-scoped in Vercel: keeps every guard on even if Vercel's system variables are not exposed at runtime (R-3).
    check("FAIL", "MARKLENS_DEPLOYMENT (preview)", env.MARKLENS_DEPLOYMENT === "preview", "Preview 환경 변수에 MARKLENS_DEPLOYMENT=preview 가 없으면 보호 장치가 VERCEL_ENV 노출 설정에 의존합니다")
    check("WARN", "NEXT_PUBLIC_SUPABASE_URL (loopback)", !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test((env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()), "loopback 주소는 로컬 QA 전용 — 배포된 Preview 에서는 DB 가 동작하지 않습니다")
    check("FAIL", "NEXT_PUBLIC_SUPABASE_URL (isolation)", databaseIsolated(env),ref ? `프로젝트 ${ref}: ${PRODUCTION_SUPABASE_REFS.includes(ref) ? "운영 프로젝트와 같음" : "운영과 다름"}` : "<ref>.supabase.co 형식이 아니라 격리를 증명할 수 없음 — Preview 는 DB 를 전혀 쓰지 않습니다")
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
    check("WARN", "AI_KILL_SWITCH", env.AI_KILL_SWITCH !== "on", "on 이면 모든 유료 AI 가 멈춥니다(비상 시에만)")
  }
  return results
}
