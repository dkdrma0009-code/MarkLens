#!/usr/bin/env node
// Compares production's real definitions of the dashboard-made objects with the Preview bundle (R-3).
//   PGLITE_MODULE=<path to @electric-sql/pglite> node scripts/release/compare-unmanaged-schema.mjs <describe.csv> <check.csv>
// <describe.csv>, <check.csv>: CSV downloads of describe-unmanaged-schema.sql and check-production-schema.sql run in the
// production SQL Editor.
// The same query runs on a fresh PGlite database built file by file from the Preview bundle, so every Preview item is
// attributed to the file that created it: an item from a repository migration (e.g. 023) that production lacks means
// "not applied there yet" (when <check.csv> says so), not "001a is wrong". Exit code 0 when 001a matches production,
// 1 otherwise, 2 when a download looks truncated. Run from the repo root.
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { previewInitFiles } from "./build-preview-sql.mjs"
import { parseSchema } from "./preflight.mjs"

export const TABLES = ["app_config", "cardnews", "feedback", "follower_snapshots", "quiz_questions", "site_feedback", "competitions"]
const DESCRIBE = "scripts/release/describe-unmanaged-schema.sql", END = "99 end"
// Supabase provides these in every project; PGlite needs stand-ins.
const SUPABASE_STUBS = `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon' $$;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean);`

/** RFC 4180 CSV (quoted fields, "" escapes, newlines inside quotes) or a JSON array → [{ section, object, name, detail }]. */
export function parseRows(text) {
  const src = text.replace(/^﻿/, "").trim()
  if (src.startsWith("[")) return JSON.parse(src).map(r => ({ section: r.section, object: r.object, name: r.name ?? "", detail: r.detail ?? "" }))
  const records = []; let row = [], field = "", quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) { if (c === '"' && src[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false; else field += c }
    else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(field); records.push(row); row = []; field = "" }
    else field += c
  }
  row.push(field); records.push(row)
  const [header, ...body] = records
  const col = name => header.indexOf(name)
  return body.filter(r => r.length > 1).map(r => ({ section: r[col("section")], object: r[col("object")], name: r[col("name")] ?? "", detail: r[col("detail")] ?? "" }))
}

const norm = s => String(s ?? "").replace(/\s+/g, " ").trim()
const key = r => `${r.section}\u0000${r.object}\u0000${r.name}`

/** Builds the Preview database file by file; returns its describe rows, each tagged with the file that introduced it. */
export async function previewRows(PGlite) {
  const db = new PGlite()
  const describe = readFileSync(DESCRIBE, "utf8")
  const origin = new Map()
  try {
    await db.exec(SUPABASE_STUBS)
    for (const file of previewInitFiles().filter(f => !f.includes("/900_"))) {
      await db.exec(readFileSync(file, "utf8"))
      for (const r of (await db.query(describe)).rows) {
        const k = `${key(r)}\u0000${norm(r.detail)}`
        if (!origin.has(k)) origin.set(k, { ...r, from: file.split("/").pop().replace(/\.sql$/, "") })
      }
    }
    const final = (await db.query(describe)).rows.filter(r => r.section !== END)
    return final.map(r => origin.get(`${key(r)}\u0000${norm(r.detail)}`))
  } finally { await db.close() }
}

/** Differences per object between Preview (tagged) and production rows; `applied` = migration numbers production has. */
export function compareRows(preview, production, applied) {
  const notApplied = from => /^\d{3}_/.test(from) && from !== "001_schema" && !applied.has(from.slice(0, 3) === "005" ? "006" : from.slice(0, 3))
  const p = new Map(preview.map(r => [key(r), r])), q = new Map(production.map(r => [key(r), r]))
  const out = {}
  const add = (object, kind, r, extra = {}) => (out[object] ??= []).push({ kind, section: r.section, name: r.name, ...extra })
  for (const [k, r] of p) {
    const prod = q.get(k)
    if (!prod) add(r.object, notApplied(r.from) ? "NOT_APPLIED_IN_PRODUCTION" : "ONLY_PREVIEW", r, { preview: r.detail, from: r.from })
    else if (norm(prod.detail) !== norm(r.detail)) add(r.object, "DIFFERENT", r, { preview: r.detail, production: prod.detail, from: r.from })
  }
  for (const [k, r] of q) if (!p.has(k)) add(r.object, "ONLY_PRODUCTION", r, { production: r.detail })
  return out
}

async function main([file, checkFile]) {
  if (!file || !checkFile || !process.env.PGLITE_MODULE) {
    console.error("usage: PGLITE_MODULE=<path to @electric-sql/pglite> node scripts/release/compare-unmanaged-schema.mjs <describe.csv> <check.csv>")
    process.exit(64)
  }
  const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE)
  const described = parseRows(readFileSync(file, "utf8"))
  const check = parseSchema(readFileSync(checkFile, "utf8"))
  // The SQL Editor can cap results; a capped download would read as "missing in production". The query's last row
  // carries its row count.
  const end = described.find(r => r.section === END)
  if (!end || Number(end.detail) !== described.length - 1 || check.length !== 23) {
    console.error(`inconclusive: describe ${end ? `has ${described.length - 1} of ${end.detail} rows` : "has no end row"}, check has ${check.length} of 23 rows — turn the SQL Editor row limit off and download again`)
    process.exit(2)
  }
  const production = described.filter(r => r.section !== END)
  const applied = new Set(check.filter(r => r.present).map(r => r.migration))
  const diffs = compareRows(await previewRows(PGlite), production, applied)
  const objects = [...new Set([...TABLES, "insights", "random_quiz", ...Object.keys(diffs)])]
  let wrong = 0
  for (const object of objects) {
    const list = diffs[object] ?? []
    const real = list.filter(d => d.kind !== "NOT_APPLIED_IN_PRODUCTION")
    wrong += real.length
    console.log(`\n[${object}] ${real.length ? `MISMATCH (${real.length})` : "MATCH"}${list.length > real.length ? ` — ${list.length - real.length} item(s) from repository migrations not applied in production` : ""}`)
    for (const d of list) {
      const what = `${d.section.padEnd(22)} ${d.name}`
      if (d.kind === "DIFFERENT") console.log(`  DIFFERENT        ${what}\n    preview    (${d.from}) ${norm(d.preview)}\n    production          ${norm(d.production)}`)
      else if (d.kind === "ONLY_PRODUCTION") console.log(`  ONLY PRODUCTION  ${what}  ${norm(d.production)}`)
      else console.log(`  ${d.kind === "ONLY_PREVIEW" ? "ONLY PREVIEW    " : "NOT APPLIED     "} ${what}  (${d.from}) ${norm(d.preview)}`)
    }
  }
  console.log(`\n${wrong ? `${wrong} difference(s) in what 001a infers — fix supabase/preview/001a_unmanaged_tables.sql and re-run` : "001a matches production"}`)
  process.exit(wrong ? 1 : 0)
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/release/compare-unmanaged-schema.mjs")) await main(process.argv.slice(2))
