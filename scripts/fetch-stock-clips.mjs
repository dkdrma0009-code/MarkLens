// Pexels 실사 세로 영상을 인사이트 '카테고리별'로 받아 1080x1920·6초·30fps·무음으로
// 규격화해 assets/video/stock/<slug>/ 에 저장한다. 키는 .env.local 의 PEXELS_API_KEY.
//
// 사용: node scripts/fetch-stock-clips.mjs
// 결과: assets/video/stock/<slug>/s01.mp4 ... + assets/video/stock/manifest.json
//   (컷 엔진/route 가 릴스의 카테고리에 맞는 폴더를 골라 쓰도록 — 주제 연결)
//
// 카테고리는 src/lib/category.ts 의 8개에 맞춘다. 폴더는 한글 대신 ASCII 슬러그로 저장한다
// (S3 키·staticFile URL 인코딩에서 한글이 403/디코딩 문제를 일으켜서). _default 는 미분류
// (용어/꿀팁·null 등) 폴백 풀.
//
// 검색어 원칙: 스톡 클리셰(handshake, high five, whiteboard, presentation meeting,
// "business~" 계열) 금지. 손·화면·거리·실제 작업 순간 같은 '날것·구체적 장면'만.

import { readFileSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
function env(k) {
  for (const l of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    if (l.startsWith("#") || !l.includes("=")) continue
    const i = l.indexOf("="); if (l.slice(0, i).trim() !== k) continue
    let v = l.slice(i + 1).trim()
    return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v
  }
  return null
}
const KEY = env("PEXELS_API_KEY")
if (!KEY) { console.error("✗ PEXELS_API_KEY 없음"); process.exit(1) }

// 카테고리(한글, category.ts 와 일치) → { slug, queries }.
// queries 는 구체적 장면 위주. 각 카테고리에서 PER_CATEGORY 개를 채운다.
const CATEGORIES = {
  "브랜딩": { slug: "branding", queries: [
    "hands arranging color swatches", "designer sketching logo tablet", "print samples close up",
    "neon shop sign street night", "product photography studio lighting", "flipping brand guide pages",
    "packaging box on table", "typography letters print",
  ] },
  "퍼포먼스 마케팅": { slug: "performance", queries: [
    "analytics dashboard screen closeup", "scrolling data charts laptop", "hand clicking mouse monitor",
    "stock chart rising screen", "typing numbers spreadsheet", "online payment phone screen",
    "graphs on computer dark office", "finger tapping metrics tablet",
  ] },
  "CRM": { slug: "crm", queries: [
    "typing email on screen closeup", "phone chat messages closeup", "calendar scheduling laptop",
    "scrolling contact list phone", "customer support headset desk", "writing client notes hand",
  ] },
  "콘텐츠 마케팅": { slug: "content", queries: [
    "typing article on laptop closeup", "video editing timeline screen", "podcast microphone closeup",
    "filming with phone on tripod", "handwriting notes notebook", "camera recording indoor creator",
  ] },
  "SEO": { slug: "seo", queries: [
    "typing in search bar closeup", "website code on screen", "scrolling search results screen",
    "keyword list on monitor", "web page loading laptop", "hands typing keyboard screen glow",
  ] },
  "소셜 미디어": { slug: "social", queries: [
    "thumb scrolling social feed phone", "filming reel with ring light", "phone notifications closeup",
    "recording selfie video creator", "social app on phone screen", "editing photo on phone",
  ] },
  "AI 마케팅": { slug: "ai", queries: [
    "typing prompt on chat screen", "code generating on monitor", "data visualization screen glow",
    "server room blue lights", "hands typing keyboard dark glow", "abstract digital network screen",
  ] },
  "소비자 심리": { slug: "psychology", queries: [
    "hand choosing product on shelf", "person browsing store shelf", "close up eyes looking",
    "people walking city street", "window shopping at night", "customer deciding at counter",
  ] },
  "_default": { slug: "default", queries: [
    "hands typing laptop closeup", "city street people walking", "desk work late night",
    "scrolling phone closeup", "writing in notebook hand", "coffee shop working laptop",
  ] },
}
const PER_CATEGORY = 8 // 카테고리당 받을 고유 클립 수

const stockDir = path.join(root, "assets", "video", "stock")
const tmpDir = path.join(root, "assets", "video", "_tmp")
// 매번 새로 채워 개수·구조가 어긋나지 않게 stock 전체를 비운다
if (existsSync(stockDir)) rmSync(stockDir, { recursive: true, force: true })
mkdirSync(stockDir, { recursive: true }); mkdirSync(tmpDir, { recursive: true })

// 세로에 가깝고 너무 크지 않은 mp4 파일 링크를 고른다
function pickFile(v) {
  const files = (v.video_files || []).filter(f => f.file_type === "video/mp4" && f.width && f.height)
  const portrait = files.filter(f => f.height > f.width)
  const pool = portrait.length ? portrait : files
  // 짧은 변(width)이 720~1440 사이를 선호, 없으면 가장 큰 것
  pool.sort((a, b) => a.width - b.width)
  return (pool.find(f => f.width >= 720 && f.width <= 1440) || pool[pool.length - 1])?.link
}

async function search(q) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=6&size=medium`
  const d = await fetch(url, { headers: { Authorization: KEY } }).then(r => r.json())
  return (d.videos || []).map(v => ({ id: v.id, dur: v.duration, link: pickFile(v) })).filter(x => x.link && x.dur >= 5)
}

async function download(link, dest) {
  const buf = Buffer.from(await (await fetch(link)).arrayBuffer())
  if (buf.length < 20000) throw new Error(`too small ${buf.length}`)
  writeFileSync(dest, buf)
}

function normalize(src, dest) {
  // 1080x1920 커버-크롭, 30fps, 앞 6초, 무음. 컷 엔진 창(0/60/120프레임)이 성립하도록 정확히 6초.
  execFileSync("ffmpeg", ["-y", "-i", src, "-t", "6",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", dest],
    { stdio: "ignore" })
}

const seen = new Set() // 카테고리 간 같은 클립 중복 방지 (전역)
const manifest = {}    // slug → [상대경로]

for (const [cat, { slug, queries }] of Object.entries(CATEGORIES)) {
  const dir = path.join(stockDir, slug)
  mkdirSync(dir, { recursive: true })
  const got = []
  console.log(`\n▶ ${cat} (${slug})`)
  for (const q of queries) {
    if (got.length >= PER_CATEGORY) break
    let results = []
    try { results = await search(q) } catch (e) { console.warn(`  검색 실패(${q}): ${e.message}`); continue }
    for (const r of results) {
      if (got.length >= PER_CATEGORY) break
      if (seen.has(r.id)) continue
      seen.add(r.id)
      const n = String(got.length + 1).padStart(2, "0")
      const raw = path.join(tmpDir, `raw.mp4`)
      const out = path.join(dir, `s${n}.mp4`)
      try {
        await download(r.link, raw)
        normalize(raw, out)
        got.push(`video/stock/${slug}/s${n}.mp4`)
        console.log(`  ✓ ${slug}/s${n}.mp4  ← "${q}" (id ${r.id})`)
      } catch (e) { console.warn(`  ✗ id ${r.id}: ${e.message}`) }
    }
  }
  manifest[slug] = got
  if (got.length < PER_CATEGORY) console.warn(`  ⚠ ${slug}: ${got.length}/${PER_CATEGORY}개만 확보 — 검색어 보강 필요`)
}

rmSync(tmpDir, { recursive: true, force: true })
// route/컴포지션이 카테고리→클립 목록을 읽을 수 있게 매니페스트 저장
writeFileSync(path.join(stockDir, "manifest.json"), JSON.stringify(manifest, null, 2))
const total = Object.values(manifest).reduce((a, b) => a + b.length, 0)
console.log(`\n총 ${total}개 클립 · ${Object.keys(manifest).length}개 카테고리`)
console.log("manifest: assets/video/stock/manifest.json")
