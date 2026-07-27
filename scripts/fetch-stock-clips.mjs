// Pexels 실사 세로 영상을 다양한 검색어로 받아 1080x1920·6초·30fps·무음으로
// 규격화해 assets/video/stock/ 에 저장한다. 키는 .env.local 의 PEXELS_API_KEY.
//
// 사용: node scripts/fetch-stock-clips.mjs
// 결과: assets/video/stock/s01.mp4 ...  (컷 엔진이 컷마다 다른 클립을 써 반복을 없앤다)

import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
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

// 마케팅·업무·사고(思考) 결의 세로 실사. 서로 다른 인물·장면이 나오게 검색어를 분산.
const QUERIES = [
  "marketing team meeting", "person working laptop office", "business woman thinking",
  "creative professional working", "typing computer closeup", "office coworkers discussion",
  "young professional city", "writing notes desk", "man thinking office window",
  "designer working studio", "woman phone scrolling", "coffee shop laptop work",
  "brainstorming whiteboard", "startup team office", "presentation meeting room",
  "reading document serious", "walking office corridor", "phone call business",
  "handshake business deal", "graphic designer screen", "video call remote work",
  "notebook planning coffee", "focused work night", "creative agency team",
  "social media manager", "analyzing charts laptop", "woman writing planner",
  "man suit thinking", "team high five office", "smartphone typing hands",
]
const TARGET = 30 // 받을 고유 클립 수 — 55초(약 27컷)도 겹침 없이 채운다

const outDir = path.join(root, "assets", "video", "stock")
const tmpDir = path.join(root, "assets", "video", "_tmp")
// 오래된 s??.mp4 가 남아 개수가 어긋나지 않게 매번 새로 채운다
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true }); mkdirSync(tmpDir, { recursive: true })

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
  const { writeFileSync } = await import("node:fs")
  writeFileSync(dest, buf)
}

function normalize(src, dest) {
  // 1080x1920 커버-크롭, 30fps, 앞 6초, 무음. 컷 엔진 창(0/60/120프레임)이 성립하도록 정확히 6초.
  execFileSync("ffmpeg", ["-y", "-i", src, "-t", "6",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", dest],
    { stdio: "ignore" })
}

const seen = new Set()
const got = []
for (const q of QUERIES) {
  if (got.length >= TARGET) break
  let results = []
  try { results = await search(q) } catch (e) { console.warn(`  검색 실패(${q}): ${e.message}`); continue }
  for (const r of results) {
    if (got.length >= TARGET) break
    if (seen.has(r.id)) continue
    seen.add(r.id)
    const n = String(got.length + 1).padStart(2, "0")
    const raw = path.join(tmpDir, `raw${n}.mp4`)
    const out = path.join(outDir, `s${n}.mp4`)
    try {
      await download(r.link, raw)
      normalize(raw, out)
      got.push(`video/stock/s${n}.mp4`)
      console.log(`  ✓ s${n}.mp4  ← "${q}" (id ${r.id})`)
    } catch (e) { console.warn(`  ✗ id ${r.id}: ${e.message}`) }
  }
}
rmSync(tmpDir, { recursive: true, force: true })
console.log(`\n받은 클립 ${got.length}개:`)
console.log(JSON.stringify(got))
