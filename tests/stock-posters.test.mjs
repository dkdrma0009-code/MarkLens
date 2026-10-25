import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-4: curation card news stock posters come from the Supabase project the deployment is connected to. Production keeps
// its exact former URLs; a Preview reads its own bucket and never production Storage (no production egress).
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, resolveJsonModule: true, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name === './stock-posters.json' ? JSON.parse(readFileSync('src/lib/cardnews/stock-posters.json', 'utf8')) : require(name), loaded, loaded.exports)
  return loaded.exports
}
const posters = load('src/lib/cardnews/stock-posters.ts')
const PROD = 'https://ndehtnchkgvpjbxlkazk.supabase.co', PREVIEW = 'https://umysmkhttlupmhttjzwi.supabase.co'
const json = JSON.parse(readFileSync('src/lib/cardnews/stock-posters.json', 'utf8'))

test('posters: production URLs are exactly the former hard-coded ones; the JSON holds bucket paths only', () => {
  assert.deepEqual(Object.keys(json), ['branding', 'performance', 'crm', 'content', 'seo', 'social', 'ai', 'psychology', 'default'])
  for (const [slug, paths] of Object.entries(json)) {
    assert.equal(paths.length, 8, slug)
    assert.ok(paths.every(p => /^[a-z]+\/s0[1-8]\.jpg$/.test(p)), slug)
    assert.deepEqual(posters.stockPosterPool(slug, PROD), paths.map(p => `${PROD}/storage/v1/object/public/stock-posters/${p}`))
  }
  assert.equal(posters.stockPosterPool('branding', PROD)[0], 'https://ndehtnchkgvpjbxlkazk.supabase.co/storage/v1/object/public/stock-posters/branding/s01.jpg')
  assert.deepEqual(posters.stockPosterPool('unknown-category', PROD), posters.stockPosterPool('default', PROD))
})

test('posters: a Preview reads its own project; nothing points at production; no project → no posters', () => {
  const all = Object.keys(json).flatMap(slug => posters.stockPosterPool(slug, PREVIEW))
  assert.equal(all.length, 72)
  assert.ok(all.every(u => u.startsWith(`${PREVIEW}/storage/v1/object/public/stock-posters/`)))
  assert.ok(!all.some(u => u.includes('ndehtnchkgvpjbxlkazk')))
  assert.equal(posters.stockPosterUrl('a/b.jpg', `﻿ ${PREVIEW}/ `), `${PREVIEW}/storage/v1/object/public/stock-posters/a/b.jpg`)
  assert.deepEqual(posters.stockPosterPool('branding', ''), [])
  // The production project ref appears in source only as the release guard's production list.
  assert.deepEqual(execSync('git grep -l ndehtnchkgvpjbxlkazk -- src', { encoding: 'utf8' }).trim().split('\n'), ['src/lib/release/guard.mjs'])
})

test('renderer: a poster that could not be fetched falls back to the hero, never re-requested; empty tiles render', () => {
  const src = readFileSync('src/lib/cardnews/curation-render-buffers.ts', 'utf8')
  assert.match(src, /stockPosterPool\(/); assert.doesNotMatch(src, /stock-posters\.json/)
  assert.match(src, /\.map\(\(x\) => x \?\? hero\)/); assert.doesNotMatch(src, /x \?\? gi\[k\]/)
  assert.match(readFileSync('src/lib/cardnews/curation-templates-editorial.tsx', 'utf8'), /\{src \? <img /)
})

test('seed-preview-posters: refuses production or an unprovable project; covers every listed path', async () => {
  const { previewTarget, posterPaths } = await import('../scripts/release/seed-preview-posters.mjs')
  for (const url of [PROD, 'https://db.example.com', '']) assert.throws(() => previewTarget({ NEXT_PUBLIC_SUPABASE_URL: url }), /refusing/, url)
  assert.throws(() => previewTarget({ NEXT_PUBLIC_SUPABASE_URL: 'https://previewtestproject01.supabase.co', MARKLENS_PREVIEW_REF: 'umysmkhttlupmhttjzwi' }), /not the pinned Preview/)
  assert.equal(previewTarget({ NEXT_PUBLIC_SUPABASE_URL: PREVIEW, MARKLENS_PREVIEW_REF: 'umysmkhttlupmhttjzwi' }), PREVIEW)
  assert.deepEqual(posterPaths().map(p => p.path), Object.values(json).flat())
})
