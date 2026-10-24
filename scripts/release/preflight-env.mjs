#!/usr/bin/env node
// MarkLens release preflight (R-2): checks an environment file for a target before deploying it.
//   vercel env pull .env.preview.local --environment=preview      (operator step)
//   node scripts/release/preflight-env.mjs .env.preview.local preview
//   node scripts/release/preflight-env.mjs .env.production.local production
// Prints variable NAMES and verdicts only — never a value. Exit code 1 when any check FAILs.
// The full release gate (git, schema, tests, guard simulation) is scripts/release/preflight.mjs (npm run release:preflight).
import { readFileSync } from "node:fs"
import { envChecks, parseEnv } from "./env-checks.mjs"

const [file, target] = process.argv.slice(2)
if (!file || !["preview", "production"].includes(target)) {
  console.error("usage: node scripts/release/preflight-env.mjs <env-file> <preview|production>")
  process.exit(2)
}

const results = envChecks(parseEnv(readFileSync(file, "utf8")), target)
for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.name.padEnd(40)} ${r.level === "PASS" ? "" : r.detail}`)
const failed = results.filter(r => r.level === "FAIL").length, warned = results.filter(r => r.level === "WARN").length
console.log(`\n${target}: ${failed} FAIL, ${warned} WARN — ${failed ? "배포하지 마세요" : "차단 항목 없음"}`)
process.exit(failed ? 1 : 0)
