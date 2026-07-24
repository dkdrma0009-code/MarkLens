// 긁은 벤치마킹 릴스를 Gemini로 분석해 "우리 릴스에 바로 쓸 규칙"을 뽑는다.
// scrape-benchmark-reels.mjs 가 저장한 원본을 입력으로 쓴다.
//
// 사용: node scripts/analyze-benchmark-reels.mjs [원본json경로]
//   경로 생략 시 output/ 의 가장 최근 파일 사용.
// 출력: scripts/output/benchmark-insights-<날짜>.md
//
// 핵심: 잘 된 릴스(참여율 상위)와 안 된 릴스(하위)를 **대비**시켜 분석한다.
// 상위만 보면 "좋은 게 좋다"는 뻔한 답이 나온다. 차이를 봐야 규칙이 나온다.

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dir, "..")
const outDir = path.join(__dir, "output")

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

// LLM 폴백 — Gemini 크레딧 소진 시 Claude, 그다음 OpenAI. src/lib/ai/llm.ts 와 같은 순서.
async function llm(prompt) {
  const gk = readEnv("GEMINI_API_KEY")
  if (gk) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gk}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          // Gemini 2.5 는 thinking 에 토큰을 먼저 쓴다. 예산을 낮추고 출력을 넉넉히 —
        // 안 그러면 thinking 이 예산을 다 먹어 응답이 잘린다.
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 512 } } }) })
      const d = await r.json()
      const t = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (r.ok && t?.trim()) return { text: t, by: "Gemini" }
      console.warn("  Gemini 실패:", (d.error?.message ?? "").slice(0, 80), "→ Claude 폴백")
    } catch (e) { console.warn("  Gemini 오류 → Claude 폴백") }
  }
  const ak = readEnv("ANTHROPIC_API_KEY")
  if (ak) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",
        { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": ak, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }) })
      const d = await r.json()
      const t = d.content?.[0]?.text
      if (r.ok && t?.trim()) return { text: t, by: "Claude" }
      console.warn("  Claude 실패:", (d.error?.message ?? "").slice(0, 80), "→ OpenAI 폴백")
    } catch (e) { console.warn("  Claude 오류 → OpenAI 폴백") }
  }
  const ok = readEnv("OPENAI_API_KEY")
  if (ok) {
    const r = await fetch("https://api.openai.com/v1/chat/completions",
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ok}` },
        body: JSON.stringify({ model: "gpt-4o", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }) })
    const d = await r.json()
    const t = d.choices?.[0]?.message?.content
    if (r.ok && t?.trim()) return { text: t, by: "OpenAI" }
    throw new Error(`OpenAI 실패: ${JSON.stringify(d).slice(0, 200)}`)
  }
  throw new Error("사용 가능한 LLM 키가 없음 (Gemini/Anthropic/OpenAI 전부 실패)")
}

// 입력 파일: 인자 또는 최신 benchmark-reels-*.json
let src = process.argv[2]
if (!src) {
  const files = readdirSync(outDir).filter(f => f.startsWith("benchmark-reels-")).sort()
  if (!files.length) { console.error("✗ output/ 에 benchmark-reels-*.json 없음 — 먼저 스크랩하세요"); process.exit(1) }
  src = path.join(outDir, files[files.length - 1])
}
const reels = JSON.parse(readFileSync(src, "utf8"))
console.log(`▶ 분석 입력: ${path.relative(root, src)} (${reels.length}릴스)`)

// 부산물(협업 태그로 딸려온 1건짜리 남 계정) 제거 — 실제 벤치마킹 계정만
const cfg = JSON.parse(readFileSync(path.join(__dir, "benchmark-accounts.json"), "utf8"))
const targets = new Set(cfg.accounts)
const clean = reels
  .filter(r => r.ownerUsername && targets.has(r.ownerUsername) && (r.videoPlayCount ?? 0) > 0)
  .map(r => ({
    user: r.ownerUsername,
    views: r.videoPlayCount ?? 0,
    eng: (r.likesCount + r.commentsCount) / (r.videoPlayCount || 1),
    dur: Math.round(r.videoDuration ?? 0),
    // [...str] 은 코드포인트 단위로 순회하므로 slice 가 이모지(서로게이트 페어)
    // 중간을 자르지 않는다. UTF-16 slice 는 반쪽을 남겨 JSON 직렬화를 깨뜨린다.
    hook: [...(r.caption ?? "").split("\n")[0]].slice(0, 120).join(""),
    ko: /[가-힣]/.test(r.caption ?? ""),
  }))

const byEng = [...clean].sort((a, b) => b.eng - a.eng)
const top = byEng.slice(0, 20)
const bottom = byEng.slice(-15)

// Gemini 에 넣을 데이터 — 상위/하위를 라벨링해서 대비
const line = r => `[${r.ko ? "KO" : "EN"}] 참여율 ${(r.eng * 100).toFixed(1)}% · ${r.dur}초 · @${r.user} · "${r.hook}"`
const prompt =
  `아래는 마케팅 인스타 계정들의 릴스 데이터다. 우리는 취준생·주니어 마케터 대상 ` +
  `한국어 마케팅 인사이트 릴스를 만든다(현재 9.6초, 정보 슬라이드쇼, 3인칭 제목, 무음).\n\n` +
  `## 참여율 높은 릴스 (잘 된 것)\n${top.map(line).join("\n")}\n\n` +
  `## 참여율 낮은 릴스 (안 된 것)\n${bottom.map(line).join("\n")}\n\n` +
  `이 대비에서 실제 패턴을 뽑아라. "좋은 콘텐츠를 만들어라" 같은 뻔한 말 금지. ` +
  `상위와 하위의 구체적 차이에 근거해서만 말하라. 아래를 한국어로:\n\n` +
  `1. 훅 공식: 잘 된 릴스 첫 문장의 실제 패턴 3~5개 (각각 우리 콘텐츠에 맞춘 예시 1개씩)\n` +
  `2. 길이·구조: 데이터가 말하는 최적 길이와 컷 구조\n` +
  `3. 한국 계정(KO) vs 글로벌(EN) 차이: 한국 타겟에 뭘 가져올까\n` +
  `4. 우리 릴스에 당장 바꿀 것 3가지 (현재 9.6초·정보제목·무음 대비 구체적으로)\n` +
  `5. 하지 말아야 할 것 (하위 릴스에서 배우는 것)`

console.log("▶ LLM 분석 중…")
const { text, by } = await llm(prompt)
console.log(`  (${by} 사용)`)

const stamp = new Date().toISOString().slice(0, 10)
const md = `# 벤치마킹 릴스 분석 — ${stamp}\n\n` +
  `입력: ${clean.length}릴스 (참여율 상위 20 vs 하위 15 대비)\n` +
  `길이 중앙값: ${[...clean].sort((a, b) => a.dur - b.dur)[Math.floor(clean.length / 2)].dur}초\n\n---\n\n${text}\n`
const outPath = path.join(outDir, `benchmark-insights-${stamp}.md`)
writeFileSync(outPath, md)
console.log(`\n${"═".repeat(70)}\n${text}\n${"═".repeat(70)}`)
console.log(`\n저장: ${path.relative(root, outPath)}`)
