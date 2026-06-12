// n8n 임포트용 워크플로 생성 — 템플릿의 __N8N_WEBHOOK_SECRET__를 실제 값으로 치환
// 사용: node scripts/build-n8n-workflows.mjs
// 출력: n8n/dist/*.json (gitignore — 시크릿 포함 파일은 절대 커밋 금지)

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs"
import { resolve, join } from "node:path"

const root = resolve(import.meta.dirname, "..")

function loadSecret() {
  if (process.env.N8N_WEBHOOK_SECRET) return process.env.N8N_WEBHOOK_SECRET
  const env = readFileSync(join(root, ".env.local"), "utf8").replace(/^\uFEFF/, "")
  for (const line of env.split(/\r?\n/)) {
    if (line.startsWith("N8N_WEBHOOK_SECRET=")) {
      return line.slice("N8N_WEBHOOK_SECRET=".length).trim().replace(/^"|"$/g, "")
    }
  }
  throw new Error("N8N_WEBHOOK_SECRET를 .env.local에서 찾을 수 없습니다")
}

const secret = loadSecret()
const srcDir = join(root, "n8n")
const outDir = join(srcDir, "dist")
mkdirSync(outDir, { recursive: true })

let count = 0
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith(".json")) continue
  const text = readFileSync(join(srcDir, file), "utf8")
  if (!text.includes("__N8N_WEBHOOK_SECRET__")) {
    console.warn(`건너뜀 (플레이스홀더 없음): ${file}`)
    continue
  }
  writeFileSync(join(outDir, file), text.replaceAll("__N8N_WEBHOOK_SECRET__", secret))
  count++
  console.log(`생성: n8n/dist/${file}`)
}
console.log(count ? `\n${count}개 생성 완료 — n8n에 Import from file로 올리세요` : "생성된 파일 없음")
