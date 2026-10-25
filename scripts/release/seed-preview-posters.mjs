#!/usr/bin/env node
// R-4: synthetic stock posters for the Preview project's public bucket "stock-posters", at the same paths
// src/lib/cardnews/stock-posters.json lists — so curation card news renders on Preview without reading production
// Storage. The production images are not copied (their source and licence are not recorded).
//   node scripts/release/seed-preview-posters.mjs .env.preview.local            dry run: writes the JPEGs locally only
//   node scripts/release/seed-preview-posters.mjs .env.preview.local --apply    uploads them (Preview project only)
// Refuses a production or unprovable Supabase URL before generating or sending anything. Never prints a key.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"
import { parseEnv } from "./env-checks.mjs"
import { databaseIsolated, supabaseRef } from "../../src/lib/release/guard.mjs"

const require = createRequire(import.meta.url)
const PALETTE = { branding: ["#1d3b8a", "#7aa2ff"], performance: ["#0f5132", "#62d39a"], crm: ["#6b2c91", "#d6a5ff"], content: ["#8a4b0f", "#ffc37a"], seo: ["#0b4f6c", "#7fd3f7"], social: ["#8a1d4f", "#ff8ac0"], ai: ["#222b45", "#a9b4ff"], psychology: ["#5a3d1e", "#e8c39e"], default: ["#2f2f2f", "#bdbdbd"] }

export function posterPaths() {
  const posters = JSON.parse(readFileSync("src/lib/cardnews/stock-posters.json", "utf8"))
  return Object.entries(posters).flatMap(([category, paths]) => paths.map(p => ({ category, path: p })))
}

/** Refuses anything but a provably non-production project (and the pinned Preview ref when one is set). */
export function previewTarget(env) {
  const ref = supabaseRef(env)
  if (!ref || !databaseIsolated(env)) throw new Error("not a provable Preview Supabase project — refusing")
  if (env.MARKLENS_PREVIEW_REF && env.MARKLENS_PREVIEW_REF !== ref) throw new Error(`ref ${ref} is not the pinned Preview project — refusing`)
  return `https://${ref}.supabase.co`
}

async function poster({ category, path: p }) {
  const sharp = require("sharp")
  const [dark, light] = PALETTE[category] ?? PALETTE.default
  const label = `${category.toUpperCase()} · ${path.basename(p, ".jpg").toUpperCase()}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>
<rect width="1080" height="1350" fill="url(#g)"/><text x="80" y="1210" font-family="Arial, sans-serif" font-size="56" fill="#ffffff" opacity="0.9">${label}</text>
<text x="80" y="1280" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" opacity="0.7">MarkLens Preview — synthetic image</text></svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer()
}

async function main(argv) {
  const file = argv[0], apply = argv.includes("--apply")
  if (!file || file.startsWith("--")) { console.error("usage: node scripts/release/seed-preview-posters.mjs <env-file> [--apply]"); process.exit(64) }
  const env = parseEnv(readFileSync(file, "utf8"))
  const base = previewTarget(env)
  const out = path.join(tmpdir(), "marklens-preview-posters")
  const items = posterPaths()
  let uploaded = 0
  for (const item of items) {
    const jpg = await poster(item)
    mkdirSync(path.dirname(path.join(out, item.path)), { recursive: true }); writeFileSync(path.join(out, item.path), jpg)
    if (!apply) continue
    const res = await fetch(`${base}/storage/v1/object/stock-posters/${item.path}`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: jpg })
    if (!res.ok) throw new Error(`upload ${item.path}: HTTP ${res.status}`)
    uploaded++
  }
  console.log(apply ? `uploaded ${uploaded} synthetic posters to ${supabaseRef(env)}/stock-posters` : `dry run: ${items.length} synthetic posters written to ${out} (nothing uploaded)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2))
