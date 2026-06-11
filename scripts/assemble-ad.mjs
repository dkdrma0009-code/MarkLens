// MarkLens 광고 조립 스크립트 v2 (스펙 §6 — ffmpeg 경로)
// 사용법: node scripts/assemble-ad.mjs <config.json>
//
// v2 추가: 펀치인 줌(zoom), 화이트 플래시 트랜지션(transition), 속도 램프(speed),
//          글로벌 그레이드(grade: 채도/대비 + 샤픈), 음악 시작 오프셋(music.offset)
//
// clip 옵션: { file, in, out,
//   speed?: 1.0,                  // 1.2 = 20% 빠르게
//   zoom?: "in" | "out",          // 펀치인/아웃 (zoomAmount 기본 1.10)
//   zoomAmount?: 1.10,
//   transition?: "cut"|"fadewhite"|"fade",  // 이전 컷에서 이 컷으로 들어올 때 (기본 cut)
//   transDur?: 0.12 }
// endcard: { image, duration, transition?: "fade", transDur?: 0.4 }
// music: { file, volume, fadeOut, offset? }   // offset = 트랙의 비트 시작점(초)
// grade: true                                  // eq 채도/대비 + unsharp

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
const CUT_DUR = 1 / FPS // "cut"도 xfade 체인을 타기 위한 1프레임 페이드 (체감 불가)

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
  args.push("-loop", "1", "-t", String(endcardDur + 1), "-i", rel(cfg.endcard.image))
  inputs.push("endcard")
}
let musicIdx = -1
if (cfg.music) {
  musicIdx = inputs.length
  args.push("-i", rel(cfg.music.file))
  inputs.push("music")
}

// ── 클립별 정규화: trim → speed → scale/crop → fps → zoom ──
const norm = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p`
const filters = []
const durs = [] // 각 클립의 (속도 반영) 실제 길이

// 30fps 프레임 격자에 스냅 — xfade 오프셋이 실제 마지막 프레임을 넘어서면 두 번째 입력이 통째로 버려진다
const snap = (sec) => Math.round(sec * FPS) / FPS

cfg.clips.forEach((c, i) => {
  const speed = c.speed ?? 1.0
  const d = snap((c.out - c.in) / speed)
  durs.push(d)
  let chain = `[${i}:v]trim=start=${c.in}:end=${c.out},setpts=(PTS-STARTPTS)/${speed},${norm}`
  if (c.zoom === "in" || c.zoom === "out") {
    const amt = c.zoomAmount ?? 1.10
    const frames = Math.max(1, Math.round(d * FPS))
    const rate = (amt - 1) / frames
    const z = c.zoom === "in"
      ? `min(1+${rate.toFixed(6)}*on,${amt})`
      : `max(${amt}-${rate.toFixed(6)}*on,1)`
    chain += `,zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`
  }
  // 마지막 프레임 클론 1초 패딩 — 블렌드 구간 프레임 기아 방지 (xfade가 두 번째 입력으로 넘어가므로 화면엔 안 보임)
  chain += `,tpad=stop_mode=clone:stop_duration=1`
  filters.push(chain + `[v${i}]`)
})

// ── xfade 체인 (cut = 1프레임 페이드) ──
let prev = "v0"
let timeline = durs[0]
for (let i = 1; i < cfg.clips.length; i++) {
  const t = cfg.clips[i].transition ?? "cut"
  const rawTd = t === "cut" ? CUT_DUR : (cfg.clips[i].transDur ?? (t === "fadewhite" ? 0.12 : 0.3))
  const td = Math.max(CUT_DUR, snap(rawTd))
  const kind = t === "cut" ? "fade" : t
  const offset = Math.max(0, snap(timeline - td))
  const out = `x${i}`
  filters.push(`[${prev}][v${i}]xfade=transition=${kind}:duration=${td.toFixed(4)}:offset=${offset.toFixed(4)}[${out}]`)
  timeline = snap(offset + td + durs[i] - td)
  prev = out
}
const bodyDur = timeline

// ── 그레이드 (본편에만 — 오버레이/엔드카드 제외) ──
if (cfg.grade) {
  filters.push(`[${prev}]eq=contrast=1.04:saturation=1.08,unsharp=5:5:0.4[graded]`)
  prev = "graded"
}

// ── 오버레이 (본편 전구간) ──
if (overlayIdx >= 0) {
  filters.push(`[${overlayIdx}:v]scale=${W}:${H}[ovl]`)
  filters.push(`[${prev}][ovl]overlay=0:0[bodyo]`)
  prev = "bodyo"
}

// ── 엔드카드 (페이드 인) ──
let totalDur = bodyDur
if (endcardIdx >= 0) {
  const td = Math.max(CUT_DUR, snap(cfg.endcard.transDur ?? 0.4))
  const kind = cfg.endcard.transition ?? "fade"
  filters.push(`[${endcardIdx}:v]${norm}[end]`)
  const offset = Math.max(0, snap(bodyDur - td))
  filters.push(`[${prev}][end]xfade=transition=${kind}:duration=${td.toFixed(4)}:offset=${offset.toFixed(4)}[outv]`)
  totalDur = snap(offset + endcardDur)
  prev = "outv"
} else {
  filters.push(`[${prev}]null[outv]`)
  prev = "outv"
}

// ── 음악 ──
const maps = ["-map", "[outv]"]
if (musicIdx >= 0) {
  const vol = cfg.music.volume ?? 1.0
  const fade = cfg.music.fadeOut ?? 1.5
  const offset = cfg.music.offset ?? 0
  const fadeStart = Math.max(0, totalDur - fade)
  filters.push(
    `[${musicIdx}:a]atrim=${offset}:${offset + totalDur},asetpts=PTS-STARTPTS,` +
    `afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeStart.toFixed(3)}:d=${fade},volume=${vol}[outa]`
  )
  maps.push("-map", "[outa]")
}

args.push(
  "-filter_complex", filters.join(";"),
  ...maps,
  "-t", totalDur.toFixed(3),
  "-c:v", "libx264", "-crf", "18", "-preset", "medium",
  "-pix_fmt", "yuv420p"
)
if (musicIdx >= 0) args.push("-c:a", "aac", "-b:a", "192k")
args.push("-movflags", "+faststart", rel(cfg.output ?? "ad-final.mp4"))

console.log(`클립 ${cfg.clips.length}개 · 본편 ${bodyDur.toFixed(1)}s` +
  (cfg.endcard ? ` + 엔드카드 ${endcardDur}s` : "") +
  ` = 총 ${totalDur.toFixed(1)}s → ${cfg.output}`)
console.log("\nffmpeg " + args.map(a => (/[\s;\[\]']/.test(a) ? `"${a}"` : a)).join(" ") + "\n")

const r = spawnSync("ffmpeg", args, { stdio: "inherit" })
if (r.status !== 0) {
  console.error("\nffmpeg 실패 (exit " + r.status + ")")
  process.exit(r.status ?? 1)
}
console.log("\n✅ 완성: " + rel(cfg.output ?? "ad-final.mp4"))
