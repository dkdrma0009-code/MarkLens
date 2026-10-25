// MarkLens release (R-4 step A): checks a `supabase db dump` backup folder (roles.sql, schema.sql, data.sql) WITHOUT
// printing any row: file sizes and SHA-256, object counts in the schema, and the number of rows each table's COPY block
// carries. Writes manifest.json next to the files. With --expect readiness.csv (production-readiness.sql as CSV) it also
// compares row counts with the live counts taken just before the dump.
//   node scripts/release/verify-backup.mjs <backup dir> [--expect production-readiness.csv]
// Exit code 0 complete, 1 missing or incomplete.
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

// Tables a restore must bring back; their data must be in data.sql (rows may legitimately be 0).
export const REQUIRED = ["public.articles", "public.insights", "public.subscribers", "public.cardnews", "public.app_config", "public.insight_challenges", "auth.users"]
const READINESS_COUNTS = { "count: articles": "public.articles", "count: insights": "public.insights", "count: cardnews": "public.cardnews", "count: insight_sessions": "public.insight_sessions", "count: auth users": "auth.users" }

const unquote = name => name.split(".").map(p => p.replace(/^"|"$/g, "")).join(".")

export function copyRowCounts(data) {
  const counts = {}
  let table = null
  for (const line of data.split(/\r?\n/)) {
    if (table === null) {
      const m = /^COPY\s+("?[\w$]+"?\."?[\w$]+"?)\s/.exec(line)
      if (m) { table = unquote(m[1]); counts[table] = counts[table] ?? 0 }
    } else if (line === "\\.") table = null
    else counts[table]++
  }
  return counts
}

export function schemaObjects(schema) {
  const count = re => (schema.match(re) ?? []).length
  const tables = [...schema.matchAll(/^CREATE TABLE (?:IF NOT EXISTS )?("?[\w$]+"?\."?[\w$]+"?)/gm)].map(m => unquote(m[1]))
  return { tables, functions: count(/^CREATE (?:OR REPLACE )?FUNCTION /gm), policies: count(/^CREATE POLICY /gm), triggers: count(/^CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER /gm), indexes: count(/^CREATE (?:UNIQUE )?INDEX /gm) }
}

export function verifyBackup(dir, expected = null) {
  const problems = [], files = {}
  for (const name of ["roles.sql", "schema.sql", "data.sql"]) {
    const file = path.join(dir, name)
    if (!existsSync(file) || statSync(file).size === 0) { problems.push(`${name} missing or empty`); continue }
    const buf = readFileSync(file)
    files[name] = { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") }
  }
  const schema = files["schema.sql"] ? schemaObjects(readFileSync(path.join(dir, "schema.sql"), "utf8")) : null
  const rows = files["data.sql"] ? copyRowCounts(readFileSync(path.join(dir, "data.sql"), "utf8")) : {}
  for (const t of REQUIRED) {
    if (schema && t.startsWith("public.") && !schema.tables.includes(t)) problems.push(`schema.sql has no table ${t}`)
    if (files["data.sql"] && !(t in rows)) problems.push(`data.sql has no COPY block for ${t}`)
  }
  const compared = {}
  if (expected) for (const [item, table] of Object.entries(READINESS_COUNTS)) {
    if (!(item in expected)) continue
    compared[table] = { live: Number(expected[item]), backup: rows[table] ?? 0 }
    // Rows can only grow between the readiness query and the dump (new articles, users); fewer means data is missing.
    if (compared[table].backup < compared[table].live) problems.push(`${table}: backup has ${compared[table].backup} rows, production had ${compared[table].live}`)
  }
  return { files, schema: schema && { ...schema, tables: schema.tables.length }, rows, compared, problems }
}

export function parseReadinessCsv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/).slice(1)) {
    const m = /^"?([^",]+)"?,"?([^"]*)"?$/.exec(line.trim())
    if (m) out[m[1]] = m[2]
  }
  return out
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, flag, csv] = process.argv.slice(2)
  if (!dir) { console.error("usage: node scripts/release/verify-backup.mjs <backup dir> [--expect production-readiness.csv]"); process.exit(1) }
  const expected = flag === "--expect" && csv ? parseReadinessCsv(readFileSync(csv, "utf8")) : null
  const result = verifyBackup(dir, expected)
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2))
  for (const [name, f] of Object.entries(result.files)) console.log(`${name.padEnd(11)} ${String(f.bytes).padStart(11)} bytes  sha256 ${f.sha256.slice(0, 16)}…`)
  if (result.schema) console.log(`schema: ${result.schema.tables} tables, ${result.schema.functions} functions, ${result.schema.policies} policies, ${result.schema.triggers} triggers, ${result.schema.indexes} indexes`)
  console.log(`data: ${Object.keys(result.rows).length} tables, ${Object.values(result.rows).reduce((a, b) => a + b, 0)} rows`)
  for (const t of REQUIRED) console.log(`  ${t.padEnd(26)} ${t in result.rows ? `${result.rows[t]} rows` : "MISSING"}`)
  for (const [t, c] of Object.entries(result.compared)) console.log(`  vs live ${t.padEnd(22)} live ${c.live} · backup ${c.backup}`)
  console.log(result.problems.length ? `\nINCOMPLETE:\n- ${result.problems.join("\n- ")}` : "\nbackup complete (manifest.json written)")
  process.exit(result.problems.length ? 1 : 0)
}
