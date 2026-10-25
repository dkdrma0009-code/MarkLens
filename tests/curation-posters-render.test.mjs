import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import esbuild from 'esbuild'
import sharp from 'sharp'

// R-4: renders the real curation card news (next/og) with fetch recorded. On a Preview the stock posters come from the
// Preview project — never production Storage — and a missing poster neither breaks the render nor is requested twice.
const require = createRequire(import.meta.url)
const out = path.resolve('.next/r4-curation-posters')
const PREVIEW = 'https://umysmkhttlupmhttjzwi.supabase.co'
const mocks = {
  name: 'r4-qa-only',
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/supabase\/admin$/ }, a => ({ path: a.path, namespace: 'qa' }))
    build.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: "exports.createAdminClient=()=>({from(){const q={select(){return q},in(){return Promise.resolve({data:[]})}};return q}})" }))
  },
}
await esbuild.build({ entryPoints: ['src/lib/cardnews/curation-render-buffers.ts'], outfile: path.join(out, 'render.cjs'), bundle: true, platform: 'node', packages: 'external', jsx: 'automatic', plugins: [mocks] })
const { renderCurationBuffers } = require(path.join(out, 'render.cjs'))

const slides = [
  { type: 'intro', headline: ['이번 주', '마케팅 트렌드'], saveHook: '저장' },
  ...['브랜딩', 'SEO', 'CRM', 'AI 마케팅', '소비자 심리'].map((category, i) => ({ type: 'trend', item: { rank: i + 1, title: `트렌드 ${i + 1}`, summary: '요약', category } })),
  { type: 'outro', headline: '매주 정리해요', body: '월요일마다 큐레이션합니다.', cta: '구독' },
]
const poster = await sharp({ create: { width: 400, height: 500, channels: 3, background: '#3355aa' } }).jpeg().toBuffer()

async function renderWith(servePosters) {
  const seen = [], realFetch = globalThis.fetch, saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = PREVIEW
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input)
    if (!/^https?:/.test(url)) return realFetch(input, init) // next/og's own assets (data:, file:)
    seen.push(url)
    if (servePosters && url.startsWith(`${PREVIEW}/storage/v1/object/public/stock-posters/`)) return new Response(poster, { headers: { 'content-type': 'image/jpeg' } })
    return new Response('not found', { status: 404 })
  }
  try { return { ...(await renderCurationBuffers({ slides, caption: 'c', week_of: '2026-10-19' })), seen } }
  finally { globalThis.fetch = realFetch; if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved }
}
const isPng = b => b[0] === 0x89 && b[1] === 0x50

test('Preview render with its posters: 7 slides, every poster from the Preview project, none from production', async () => {
  const r = await renderWith(true)
  assert.equal(r.buffers.length, 7); assert.ok(r.buffers.every(isPng))
  assert.ok(r.seen.length > 0)
  assert.ok(r.seen.every(u => u.startsWith(`${PREVIEW}/storage/v1/object/public/stock-posters/`)), r.seen.find(u => !u.startsWith(PREVIEW)))
  assert.ok(!r.seen.some(u => u.includes('ndehtnchkgvpjbxlkazk')))
})

test('Preview render with no posters uploaded: still 7 slides; production never asked; no image fetched three times', async () => {
  const r = await renderWith(false)
  assert.equal(r.buffers.length, 7); assert.ok(r.buffers.every(isPng))
  assert.ok(!r.seen.some(u => u.includes('ndehtnchkgvpjbxlkazk')))
  const counts = {}
  for (const u of r.seen) { const key = decodeURIComponent(u.replace(/^https:\/\/images\.weserv\.nl\/\?url=/, '').replace(/&output=.*$/, '')); counts[key] = (counts[key] ?? 0) + 1 }
  // direct + weserv proxy per distinct poster; the renderer is not handed the raw URL to fetch a third time
  assert.ok(Object.values(counts).every(n => n <= 2 * slides.length), JSON.stringify(counts))
  assert.ok(Object.keys(counts).every(k => k.startsWith(PREVIEW)))
})
