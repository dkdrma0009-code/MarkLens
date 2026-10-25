#!/usr/bin/env node
// MarkLens release gate (R-3): one verdict before a Preview or Production deploy.
//   npm run release:preflight -- --target preview --env .env.preview.local --schema preview-schema.csv --run-tests
//   npm run release:preflight -- --target production --env .env.production.local --schema production-schema.csv
// --env     output of `vercel env pull <file> --environment=<target>` (operator step)
// --schema  result of scripts/release/check-production-schema.sql run in the target project (CSV or JSON download)
// --run-tests / --run-build  run typecheck, lint and the test suite / `next build` (build inherits this shell's env)
// Each check is PASS, WARN (does not block), FAIL or UNKNOWN. UNKNOWN is never a PASS: the gate passes only when
// nothing failed and nothing is unknown. Exit code 0 PASS, 1 FAIL, 2 UNKNOWN. Names and verdicts only — never a value.
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { envChecks, parseEnv } from "./env-checks.mjs"
import { blockedReason, deployment, guardFetch } from "../../src/lib/release/guard.mjs"

const EXTERNAL = ["instagram", "threads", "email", "aws", "cron"]
// 005 is superseded by 006 (the check reads the end state); every other migration must be in the schema check.
const UNCHECKED_MIGRATIONS = ["005"]

/** The migration numbers check-production-schema.sql reports, read from the SQL itself (one row per number). */
export function checkedMigrations(sql = readFileSync("scripts/release/check-production-schema.sql", "utf8")) {
  return [...sql.matchAll(/^\s*\('(\d{3})',/gm)].map(m => m[1])
}

/** "migration,artifact,present" CSV or a JSON array of rows → [{ migration, present }]. @param {string} text */
export function parseSchema(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith("[")) return JSON.parse(trimmed).map(r => ({ migration: String(r.migration), present: r.present === true || r.present === "true" }))
  return trimmed.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const cells = line.split(",")
    return { migration: cells[0].replace(/"/g, "").trim(), present: /^"?(true|t)"?$/i.test(cells.at(-1).trim()) }
  })
}

/**
 * @param {{ target: "preview" | "production", env?: Record<string, string> | null, schema?: { migration: string, present: boolean }[] | null,
 *   git?: { branch: string, dirty: string[], containsMaster: boolean | null, pushed: boolean, trackedEnvFiles: string[] } | null,
 *   migrations: string[], schemaCheckSql: string, runs?: Record<string, { ok: boolean, skipped?: number, detail?: string }> }} input
 */
export async function preflightChecks({ target, env = null, schema = null, git = null, migrations, schemaCheckSql, runs = {} }) {
  const results = []
  const add = (area, level, name, detail = "") => results.push({ area, level, name, detail })

  // Git: what will be deployed is what was tested.
  if (!git) add("git", "UNKNOWN", "repository", "git 상태를 읽지 못했습니다")
  else {
    add("git", "PASS", `branch ${git.branch}`)
    add("git", git.dirty.length ? "FAIL" : "PASS", "clean working tree", git.dirty.length ? `커밋되지 않은 변경 ${git.dirty.length}개 — 테스트한 코드와 배포 코드가 달라집니다` : "")
    add("git", git.containsMaster === null ? "UNKNOWN" : git.containsMaster ? "PASS" : target === "production" ? "FAIL" : "WARN", "contains origin/master", git.containsMaster === false ? "origin/master 의 커밋이 빠져 있습니다 — 병합 전 갱신 필요" : git.containsMaster === null ? "origin/master 를 찾지 못했습니다" : "")
    add("git", git.pushed ? "PASS" : "WARN", "HEAD pushed", git.pushed ? "" : "원격에 없는 커밋 — Preview 배포는 승인 후 push 로 시작됩니다")
    add("git", git.trackedEnvFiles.length ? "FAIL" : "PASS", "no tracked env files", git.trackedEnvFiles.length ? `추적 중인 env 파일: ${git.trackedEnvFiles.join(", ")}` : "")
  }

  // Environment variables (vercel env pull of the target environment).
  if (!env) add("env", "UNKNOWN", "environment file", "--env 없음: vercel env pull 로 받은 파일이 필요합니다")
  else for (const r of envChecks(env, target)) add("env", r.level, r.name, r.level === "PASS" ? "" : r.detail)

  // Classification and blocking, simulated with the Vercel system variables the target sets.
  if (env) {
    const vercel = { ...env, VERCEL: "1", VERCEL_ENV: target, VERCEL_TARGET_ENV: target }
    // MARKLENS_DEPLOYMENT=preview keeps the guards on even if Vercel's system variables were not exposed at runtime.
    const bare = { ...env, VERCEL: undefined, VERCEL_ENV: undefined, VERCEL_TARGET_ENV: undefined }
    if (target === "preview") {
      add("guard", deployment(vercel) === "preview" ? "PASS" : "FAIL", "classified as preview on Vercel")
      add("guard", deployment(bare) === "preview" ? "PASS" : "FAIL", "classified as preview without Vercel system env", deployment(bare) === "preview" ? "" : "MARKLENS_DEPLOYMENT=preview 가 없으면 VERCEL_ENV 노출 설정에 의존합니다")
      const open = EXTERNAL.filter(a => !blockedReason(a, vercel))
      add("guard", open.length ? "FAIL" : "PASS", "external actions blocked", open.join(", "))
      add("guard", blockedReason("ai", vercel) ? "PASS" : "WARN", "paid AI blocked", blockedReason("ai", vercel) ? "" : "PREVIEW_ALLOW_AI=true — 일일 한도 안에서 유료 AI 허용")
      add("guard", blockedReason("database", vercel) ? "FAIL" : "PASS", "database usable (isolated)", blockedReason("database", vercel) ? "격리를 증명할 수 없어 Preview 가 DB 를 전혀 쓰지 않습니다" : "")
      const sent = []
      const guarded = guardFetch(async url => { sent.push(String(url)); return new Response("{}") }, vercel)
      const probes = [["https://graph.instagram.com/v21.0/1/media_publish", "POST"], ["https://graph.threads.net/v1.0/1/threads_publish", "POST"], ["https://api.brevo.com/v3/smtp/email", "POST"]]
      for (const [url, method] of probes) await guarded(url, { method }).catch(() => null)
      add("guard", sent.length ? "FAIL" : "PASS", "egress refused (IG, Threads, Brevo)", sent.join(", "))
    } else {
      add("guard", deployment(vercel) === "production" ? "PASS" : "FAIL", "classified as production on Vercel")
      const blocked = [...EXTERNAL, "database"].filter(a => blockedReason(a, vercel))
      add("guard", blocked.length ? "FAIL" : "PASS", "production features not blocked", blocked.join(", "))
    }
  } else add("guard", "UNKNOWN", "guard simulation", "--env 없음")

  // Migrations: local numbering is covered by the schema check; the target database has them.
  const numbers = migrations.map(f => /^(\d{3})_/.exec(f)?.[1]).filter(Boolean)
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i)
  const unchecked = numbers.filter(n => !UNCHECKED_MIGRATIONS.includes(n) && !schemaCheckSql.includes(`('${n}',`))
  add("migrations", duplicates.length || unchecked.length ? "FAIL" : "PASS", "local migrations covered by schema check", [duplicates.length ? `중복 ${duplicates.join(", ")}` : "", unchecked.length ? `check-production-schema.sql 에 없음: ${unchecked.join(", ")}` : ""].filter(Boolean).join("; "))
  if (!schema) {
    add("migrations", "UNKNOWN", "target database schema", "--schema 없음: check-production-schema.sql 결과가 필요합니다")
    add("ai", "UNKNOWN", "AI quota (024) present", "--schema 없음 — 024 없이는 모든 공개 AI 기능이 503 입니다")
  } else {
    const present = new Set(schema.filter(r => r.present).map(r => r.migration))
    const expected = numbers.filter(n => !UNCHECKED_MIGRATIONS.includes(n))
    const missing = expected.filter(n => !present.has(n))
    add("migrations", missing.length ? "FAIL" : "PASS", "target database schema", missing.length ? `없음: ${missing.join(", ")}${target === "production" ? " — 배포 전에 적용" : " — Preview 번들(build-preview-sql.mjs) 적용 필요"}` : "")
    add("ai", present.has("024") ? "PASS" : "FAIL", "AI quota (024) present", present.has("024") ? "" : "024 없이는 모든 공개 AI 기능이 503 입니다(fail-closed)")
  }
  if (env) add("ai", env.AI_KILL_SWITCH === "on" ? "WARN" : "PASS", "AI_KILL_SWITCH off", env.AI_KILL_SWITCH === "on" ? "모든 유료 AI 가 멈춘 상태로 배포됩니다" : "")

  // Typecheck, lint, tests, build.
  for (const name of ["typecheck", "lint", "tests", "build"]) {
    const run = runs[name]
    if (!run) add("verify", "UNKNOWN", name, name === "build" ? "--run-build 로 실행" : "--run-tests 로 실행")
    else if (!run.ok) add("verify", "FAIL", name, run.detail ?? "")
    else if (run.skipped) add("verify", "UNKNOWN", name, `${run.skipped}개 생략 — SQL 테스트는 PGLITE_MODULE 필요`)
    else add("verify", "PASS", name, run.detail ?? "")
  }

  const verdict = results.some(r => r.level === "FAIL") ? "FAIL" : results.some(r => r.level === "UNKNOWN") ? "UNKNOWN" : "PASS"
  return { verdict, results }
}

function gitState() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  try {
    const head = git("rev-parse", "HEAD")
    let containsMaster = null
    try { git("rev-parse", "--verify", "origin/master"); containsMaster = spawnSync("git", ["merge-base", "--is-ancestor", "origin/master", head]).status === 0 } catch { /* no remote ref */ }
    return {
      branch: git("rev-parse", "--abbrev-ref", "HEAD"),
      dirty: git("status", "--porcelain").split("\n").filter(Boolean),
      containsMaster,
      pushed: git("branch", "-r", "--contains", head) !== "",
      trackedEnvFiles: git("ls-files").split("\n").filter(f => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f)),
    }
  } catch { return null }
}

/** The environment unit tests run in: this shell's, without the variables that classify a deployment. */
export function unitTestEnv(env) {
  const out = { ...env }
  for (const k of ["MARKLENS_DEPLOYMENT", "VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV", "AI_KILL_SWITCH", "PREVIEW_ALLOW_AI"]) delete out[k]
  return out
}

function run(command, args, env = process.env) {
  // npx is a .cmd shim on Windows and needs a shell; node itself must not go through one (its path has spaces).
  const res = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" && command === "npx", env, maxBuffer: 64 * 1024 * 1024 })
  return { status: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` }
}

async function main(argv) {
  const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  const target = opt("--target")
  if (!["preview", "production"].includes(target)) {
    console.error("usage: npm run release:preflight -- --target <preview|production> [--env <file>] [--schema <file>] [--run-tests] [--run-build]")
    process.exit(64)
  }
  const runs = {}
  if (argv.includes("--run-tests")) {
    const tsc = run("npx", ["tsc", "--noEmit"]); runs.typecheck = { ok: tsc.status === 0, detail: tsc.status === 0 ? "" : "tsc 오류" }
    const lint = run("npx", ["eslint"]); runs.lint = { ok: lint.status === 0, detail: lint.status === 0 ? "" : "eslint 오류" }
    const files = readdirSync("tests").filter(f => f.endsWith(".test.mjs")).map(f => `tests/${f}`)
    // Unit tests describe the code under a neutral (local) classification; a shell carrying the target's deployment
    // variables (e.g. MARKLENS_DEPLOYMENT=preview for --run-build) would turn the guards on inside them.
    const tests = run(process.execPath, ["--test", ...files], unitTestEnv(process.env))
    const count = key => Number(new RegExp(`^# ${key} (\\d+)`, "m").exec(tests.out)?.[1] ?? 0)
    runs.tests = { ok: tests.status === 0 && count("fail") === 0 && count("pass") > 0, skipped: count("skipped"), detail: `${count("pass")} pass, ${count("fail")} fail` }
  }
  if (argv.includes("--run-build")) { const build = run("npx", ["next", "build"]); runs.build = { ok: build.status === 0, detail: build.status === 0 ? "" : "next build 실패" } }

  const { verdict, results } = await preflightChecks({
    target,
    env: opt("--env") ? parseEnv(readFileSync(opt("--env"), "utf8")) : null,
    schema: opt("--schema") ? parseSchema(readFileSync(opt("--schema"), "utf8")) : null,
    git: gitState(),
    migrations: readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")),
    schemaCheckSql: readFileSync("scripts/release/check-production-schema.sql", "utf8"),
    runs,
  })
  let area = ""
  for (const r of results) {
    if (r.area !== area) console.log(`\n[${(area = r.area)}]`)
    console.log(`${r.level.padEnd(7)} ${r.name.padEnd(48)} ${r.detail}`)
  }
  console.log(`\n${target}: ${verdict} — ${verdict === "PASS" ? "배포 차단 항목 없음" : verdict === "FAIL" ? "배포하지 마세요" : "확인되지 않은 항목이 있습니다(UNKNOWN 은 통과가 아닙니다)"}`)
  process.exit(verdict === "PASS" ? 0 : verdict === "FAIL" ? 1 : 2)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
