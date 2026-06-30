// Remotion 숏츠 사이트를 S3에 재배포한다.
// 숏츠 컴포지션/템플릿(src/remotion, src/lib/shorts)을 바꾸면 이 스크립트를 반드시 실행해야
// Lambda 렌더에 반영된다 (git push·Vercel 배포만으론 S3 사이트 번들이 갱신되지 않음).
//
// 사용: npm run shorts:deploy
// 전제: .env.local 에 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / REMOTION_SERVE_URL
//   - 기존 사이트명(REMOTION_SERVE_URL에서 파싱)으로 덮어써서 URL을 유지 → env 변경 불필요
//   - publicDir=assets 로 Pretendard 폰트를 번들에 포함 (누락 시 한글이 폴백 폰트로 깨짐)

import { readFileSync } from "node:fs"
import path from "node:path"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return [l.slice(0, i).trim(), v] })
)
for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "REMOTION_SERVE_URL"]) {
  if (!env[k]) { console.error(`✗ .env.local 에 ${k} 가 없습니다`); process.exit(1) }
  process.env[k] = env[k]
}
const region = env.AWS_REGION.trim()
const siteName = (env.REMOTION_SERVE_URL.match(/\/sites\/([^/]+)\//) || [])[1]
if (!siteName) { console.error("✗ REMOTION_SERVE_URL 에서 사이트명을 찾지 못했습니다"); process.exit(1) }

const { deploySite, getOrCreateBucket } = await import("@remotion/lambda")
const { bucketName } = await getOrCreateBucket({ region })
console.log(`배포: site=${siteName} region=${region} bucket=${bucketName} (publicDir=assets)`)
const { serveUrl } = await deploySite({
  entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"),
  bucketName, region, siteName,
  publicDir: path.join(process.cwd(), "assets"),
})
if (serveUrl === env.REMOTION_SERVE_URL) console.log("✅ 완료 — URL 동일, env 변경 불필요:\n  " + serveUrl)
else console.warn("⚠️ serveUrl 변경됨 — Vercel REMOTION_SERVE_URL env 업데이트 필요:\n  " + serveUrl)
