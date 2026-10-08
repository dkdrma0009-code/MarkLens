import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import esbuild from "esbuild"
import fixtures from "./fixtures/cardnews-v2.cjs"

const out = path.resolve(".next/grounded-verification")
await fs.mkdir(out, { recursive: true })
const requireBundle = createRequire(import.meta.url)
async function bundle(entry, name) {
  const file = path.join(out, `${name}.cjs`)
  await esbuild.build({ entryPoints: [entry], outfile: file, bundle: true, platform: "node", packages: "external" })
  return requireBundle(file)
}
const { actionSources, groundedCopyErrors, overlappingClaim } = await bundle("src/lib/cardnews/grounded-copy.ts", "grounded")
const { validateCardnews } = await bundle("src/lib/cardnews/validate.ts", "validate")
const { sourceMetric, visualFamily } = await bundle("src/lib/cardnews/editorial.ts", "editorial")
const input = { title: "실제 캠페인", hook: "실제 캠페인", summary: "", why: "", apply: "지역 예술가와 협업하세요. 공익 메시지를 예술로 전달하세요.", takeaways: [], raw: "" }
assert.equal(actionSources(input).length, 1, "Two sentences within one recommendation must remain one unit")
assert.equal(actionSources({ ...input, apply: "첫째, 고객을 인터뷰하세요. 둘째, 설문으로 확인하세요." }).length, 2)
assert.equal(actionSources({ ...input, apply: "1. 고객을 인터뷰하세요. 2. 설문으로 확인하세요." }).length, 2)
assert.equal(actionSources({ ...input, apply: "" }).length, 0)
const action = body => ({ category: "브랜딩", slides: [{ type: "apply", role: "action", body }] })
assert.deepEqual(groundedCopyErrors(action("지역 예술가와 협업하세요."), input, [1]), [])
assert.ok(groundedCopyErrors(action("지역 예술가와 협업하세요.\n공익 메시지를 전달하세요.\n예술 협업을 활용하세요."), input, [1, 1, 1]).length)
assert.ok(groundedCopyErrors(action("할인을 제공하세요."), input, [1]).length)
assert.ok(groundedCopyErrors(action("AI 경험의 정성적 영향력을 강화하세요."), { ...input, apply: "AI 경험의 정성적 영향을 인터뷰로 파악하세요." }, [1]).length)
assert.ok(groundedCopyErrors(action("지역 예술가와 협업하세요."), { ...input, apply: "" }, [1]).length)
assert.ok(overlappingClaim("AI 챗봇이 개인화된 검색 엔진처럼 작동하며, 직접 답변을 제공합니다.", "챗봇은 개인화된 검색 엔진처럼 작동하며, 효과 추적은 어렵습니다."))
assert.equal(overlappingClaim("AI 검색은 브랜드 발견의 접점입니다.", "AI 검색의 클릭 없는 여정은 기존 측정을 어렵게 합니다."), false)
assert.equal(overlappingClaim("소비자가 브랜드를 검색합니다.", "브랜드의 인지와 소비자 행동을 인터뷰로 확인합니다."), false)
for (const roles of [["hook", "what", "why", "take", "end"], ["hook", "what", "context", "take", "action", "end"]]) {
  const base = structuredClone(fixtures.photo)
  base.slides = roles.map(role => base.slides.find(s => s.role === role))
  assert.deepEqual(validateCardnews(base), [])
}
const abstract = structuredClone(fixtures.typography)
abstract.slides[0].headline = ["AI 시대의", "새로운 기회"]
assert.ok(validateCardnews(abstract).some(e => e.includes("추상")))
const brand = structuredClone(fixtures.typography)
brand.slides[0].headline = ["Water Corporation", "Australia", "예술로 물을 지키다"]
assert.deepEqual(validateCardnews(brand), [])
assert.deepEqual(groundedCopyErrors({ category: brand.category, slides: [brand.slides[0]] }, { ...input, hook: "Water Corporation Australia 예술로 물을 지키다" }), [])
brand.slides[0].headline = ["WCA", "예술로 물을 지키다"]
assert.ok(groundedCopyErrors({ category: brand.category, slides: [brand.slides[0]] }, { ...input, hook: "Water Corporation Australia 예술로 물을 지키다" }).length)
const metric = sourceMetric(fixtures.data.slides, fixtures.data.slides[2].body, "", "2026-10-08")
assert.equal(metric, null)
assert.notEqual(visualFamily("데이터", fixtures.data.slides, false, metric), "data")
assert.ok(groundedCopyErrors(action("전환율을 80% 높이세요."), input, [1]).some(e => e.includes("수치")))
assert.deepEqual(validateCardnews(fixtures.legacy), [])
console.log("PASS: source units, grounded action, zero action, overlap vs shared keywords, optional roles, concrete hook, official name, insufficient numeric source, legacy validation")
