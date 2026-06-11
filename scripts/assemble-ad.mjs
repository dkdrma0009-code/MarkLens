// MarkLens 광고 조립 스크립트 (스펙 §6 — ffmpeg 경로)
// 사용법: node scripts/assemble-ad.mjs <config.json>
// 설정 예시는 scripts/ad-config.example.json 참고
//
// 파이프라인: 클립별 트림 → 1080×1920 정규화 → concat → 오버레이 PNG(전구간)
//             → 엔드카드(이미지 N초) → 음악(페이드아웃) → mp4

import { spawnSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"

const configPath = process.argv[2]
if (!configPath) {
  console.error("사용법: node scripts/assemble-ad.mjs <config.json>")
  process.exit(1)
}

const cfgDir = dirname(resolve(configPath))
const cfg = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""))
const W = cfg.width ?? 1080
const H = cfg.height ?? 1920
const FPS = cfg.fps ?? 30

// 설정 파일 기준 상대경로 해석
const rel = (p) => resolve(cfgDir, p)

const missing = []
const checkFile = (p, label) => {
  if (!existsSync(rel(p))) missing.push(`${label}: ${p}`)
}

if (!Array.isArray(cfg.clips) || cfg.clips.length === 0) {
  console.error("config.clips가 비어 있습니다")
  process.exit(1)
}
cfg.clips.forEach((c, i) => checkFile(c.file, `clips[${i}]`))
if (cfg.overlay) checkFile(cfg.overlay, "overlay")
if (cfg.endcard) checkFile(cfg.endcard.image, "endcard")
if (cfg.music) checkFile(cfg.music.file, "music")
if (missing.length) {
  console.error("파일을 찾을 수 없습니다:\n  " + missing.join("\n  "))
  process.exit(1)
}

// ── 입력 구성 ──
const args = ["-y"]
const inputs = []

for (const c of cfg.clips) {
  args.push("-i", rel(c.file))
  inputs.push("clip")
}
let overlayIdx = -1
if (cfg.overlay) {
  overlayIdx = inputs.length
  args.push("-i", rel(cfg.overlay))
  inputs.push("overlay")
}
let endcardIdx = -1
const endcardDur = cfg.endcard?.duration ?? 2.5
if (cfg.endcard) {
  endcardIdx = inputs.length
  args.push("-loop", "1", "-t", String(endcardDur), "-i", rel(cfg.endcard.image))
  inputs.push("endcard")
}
let musicIdx = -1
if (cfg.music) {
  musicIdx = inputs.length
  args.push("-i", rel(cfg.music.file))
  inputs.push("music")
}

// ── 필터 그래프 ──
const norm = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p`
const filters = []
const bodyDur = cfg.clips.reduce((sum, c) => sum + (c.out - c.in), 0)
const totalDur = bodyDur + (cfg.endcard ? endcardDur : 0)

cfg.clips.forEach((c, i) => {
  filters.push(`[${i}:v]trim=start=${c.in}:end=${c.out},setpts=PTS-STARTPTS,${norm}[v${i}]`)
})
filters.push(cfg.clips.map((_, i) => `[v${i}]`).join("") + `concat=n=${cfg.clips.length}:v=1:a=0[body]`)

let chain = "body"
if (overlayIdx >= 0) {
  filters.push(`[${overlayIdx}:v]scale=${W}:${H}[ovl]`)
  filters.push(`[${chain}][ovl]overlay=0:0[bodyo]`)
  chain = "bodyo"
}
if (endcardIdx >= 0) {
  filters.push(`[${endcardIdx}:v]${norm}[end]`)
  filters.push(`[${chain}][end]concat=n=2:v=1:a=0[outv]`)
  chain = "outv"
} else {
  filters.push(`[${chain}]null[outv]`)
  chain = "outv"
}

const maps = ["-map", "[outv]"]
if (musicIdx >= 0) {
  const vol = cfg.music.volume ?? 1.0
  const fade = cfg.music.fadeOut ?? 1.5
  const fadeStart = Math.max(0, totalDur - fade)
  filters.push(
    `[${musicIdx}:a]atrim=0:${totalDur},asetpts=PTS-STARTPTS,` +
    `afade=t=out:st=${fadeStart}:d=${fade},volume=${vol}[outa]`
  )
  maps.push("-map", "[outa]")
}

args.push(
  "-filter_complex", filters.join(";"),
  ...maps,
  "-c:v", "libx264", "-crf", "18", "-preset", "medium",
  "-pix_fmt", "yuv420p"
)
if (musicIdx >= 0) args.push("-c:a", "aac", "-b:a", "192k")
args.push("-movflags", "+faststart", rel(cfg.output ?? "ad-final.mp4"))

console.log(`클립 ${cfg.clips.length}개 · 본편 ${bodyDur.toFixed(1)}s` +
  (cfg.endcard ? ` + 엔드카드 ${endcardDur}s` : "") +
  ` = 총 ${totalDur.toFixed(1)}s → ${cfg.output}`)
console.log("\nffmpeg " + args.map(a => (/[\s;\[\]]/.test(a) ? `"${a}"` : a)).join(" ") + "\n")

const r = spawnSync("ffmpeg", args, { stdio: "inherit" })
if (r.status !== 0) {
  console.error("\nffmpeg 실패 (exit " + r.status + ")")
  process.exit(r.status ?? 1)
}
console.log("\n✅ 완성: " + rel(cfg.output ?? "ad-final.mp4"))
