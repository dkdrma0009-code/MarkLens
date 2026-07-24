// 벤치마킹 계정의 릴스를 Apify로 긁어 성과순으로 분석한다.
// 우리 인스타 계정을 안 쓰므로(Apify가 대신 긁음) 계정 정지 위험이 없다.
//
// 사용: node scripts/scrape-benchmark-reels.mjs
// 전제: .env.local 에 APIFY_API_TOKEN
// 출력: scripts/output/benchmark-reels-<날짜>.json (원본) + 콘솔 요약
//
// 비용: 릴스당 $0.0023 (Apify instagram-reel-scraper). 100릴스 ≈ $0.23.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dir, "..")

// .env.local 에서 토큰만 읽는다 (전체 dotenv 불필요)
function readEnv(key) {
  const txt = readFileSync(path.join(root, ".env.local"), "utf8")
  for (const line of txt.split(/\r?\n/)) {
    if (line.startsWith("#") || !line.includes("=")) continue
    const i = line.indexOf("=")
    if (line.slice(0, i).trim() === key) {
      let v = line.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      return v
    }
  }
  return null
}

const TOKEN = readEnv("APIFY_API_TOKEN")
if (!TOKEN) { console.error("✗ .env.local 에 APIFY_API_TOKEN 이 없습니다"); process.exit(1) }

const cfg = JSON.parse(readFileSync(path.join(__dir, "benchmark-accounts.json"), "utf8"))
const { accounts, reelsPerAccount } = cfg
console.log(`▶ ${accounts.length}개 계정 × ${reelsPerAccount}릴스 긁는 중… (Apify, 최대 몇 분)`)

// 동기 실행 — 데이터셋 아이템을 바로 받는다
const res = await fetch(
  `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${TOKEN}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: accounts, resultsLimit: reelsPerAccount }),
  },
)
if (!res.ok) { console.error(`✗ Apify 오류 ${res.status}:`, (await res.text()).slice(0, 300)); process.exit(1) }
const reels = await res.json()
console.log(`✔ 릴스 ${reels.length}개 수신\n`)

// 원본 저장 (재분석·아카이브용)
const outDir = path.join(__dir, "output")
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
const rawPath = path.join(outDir, `benchmark-reels-${stamp}.json`)
writeFileSync(rawPath, JSON.stringify(reels, null, 2))

// 지표 정규화 — ownerUsername 없는 항목(태그된 부산물 등)은 버린다
const norm = reels.filter(r => r.ownerUsername).map(r => ({
  user: r.ownerUsername,
  views: r.videoPlayCount ?? 0,
  likes: r.likesCount ?? 0,
  comments: r.commentsCount ?? 0,
  dur: Math.round(r.videoDuration ?? 0),
  // 참여율 = (좋아요+댓글)/조회 — 조회 대비 얼마나 반응했나. 도달보다 콘텐츠 힘을 본다.
  eng: r.videoPlayCount ? (r.likesCount + r.commentsCount) / r.videoPlayCount : 0,
  hook: (r.caption ?? "").split("\n")[0].slice(0, 80),
  hashtags: (r.hashtags ?? []).length,
  url: r.url,
}))

const fmt = n => n.toLocaleString("en-US")
const byViews = [...norm].sort((a, b) => b.views - a.views)
const byEng = [...norm].filter(r => r.views >= 3000).sort((a, b) => b.eng - a.eng)

console.log("═".repeat(70))
console.log("조회수 TOP 10 — 무엇이 도달했나")
console.log("═".repeat(70))
for (const r of byViews.slice(0, 10)) {
  console.log(`▶${fmt(r.views).padStart(10)}  ♥${fmt(r.likes).padStart(7)}  💬${fmt(r.comments).padStart(5)}  ${String(r.dur).padStart(3)}s  @${r.user}`)
  console.log(`   ${r.hook}`)
}

console.log("\n" + "═".repeat(70))
console.log("참여율 TOP 10 (조회 3천+) — 무엇이 반응을 끌었나")
console.log("═".repeat(70))
for (const r of byEng.slice(0, 10)) {
  console.log(`${(r.eng * 100).toFixed(1)}%  ▶${fmt(r.views).padStart(9)}  ${String(r.dur).padStart(3)}s  @${r.user}`)
  console.log(`   ${r.hook}`)
}

// 집계 — 트렌드 가설 검증용
const withViews = norm.filter(r => r.views > 0)
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0 }
console.log("\n" + "═".repeat(70))
console.log("집계")
console.log("═".repeat(70))
console.log(`릴스 수: ${norm.length}`)
console.log(`길이 중앙값: ${med(withViews.map(r => r.dur))}초   (우리 릴스: 9.6초)`)
console.log(`조회 중앙값: ${fmt(med(withViews.map(r => r.views)))}`)
console.log(`계정별 릴스:`, Object.entries(
  norm.reduce((a, r) => (a[r.user] = (a[r.user] ?? 0) + 1, a), {}),
).map(([u, n]) => `${u}:${n}`).join("  "))

console.log(`\n원본 저장: ${path.relative(root, rawPath)}`)
