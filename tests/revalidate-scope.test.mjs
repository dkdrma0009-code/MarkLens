import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import esbuild from "esbuild"

// revalidatePublicContent가 상세 route 전체가 아니라 바뀐 slug만 무효화하는지 검증한다.
// next/cache.revalidatePath는 호출 기록용 스텁으로 대체한다.
const out = path.resolve(".next/revalidate-scope-test")
await fs.mkdir(out, { recursive: true })
const file = path.join(out, "revalidate.cjs")
await esbuild.build({
  entryPoints: ["src/lib/revalidate.ts"],
  outfile: file,
  bundle: true,
  platform: "node",
  format: "cjs",
  plugins: [{
    name: "stub-next-cache",
    setup(build) {
      build.onResolve({ filter: /^next\/cache$/ }, () => ({ path: "next-cache-stub", namespace: "stub" }))
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "exports.revalidatePath = (p, type) => { (globalThis.__revalidateCalls ??= []).push(type ? [p, type] : [p]) }",
        loader: "js",
      }))
    },
  }],
})
const { revalidatePublicContent } = createRequire(import.meta.url)(file)

function calls(fn) {
  globalThis.__revalidateCalls = []
  fn()
  return globalThis.__revalidateCalls
}
const COMMON = [["/"], ["/insights"]]

test("slug 1개: 홈·목록 + 해당 상세 1개만", () => {
  assert.deepEqual(calls(() => revalidatePublicContent({ slugs: ["foo"] })), [...COMMON, ["/insights/foo"]])
})

test("slug 3개: 세 상세 URL만 (상세 route 패턴 전체 무효화 없음)", () => {
  const c = calls(() => revalidatePublicContent({ slugs: ["foo", "bar", "baz"] }))
  assert.deepEqual(c, [...COMMON, ["/insights/foo"], ["/insights/bar"], ["/insights/baz"]])
  assert.ok(!c.some(([p, type]) => p.includes("[slug]") || type === "page"))
})

test("slugs 비어 있음/인자 없음: 상세 무효화 0회", () => {
  assert.deepEqual(calls(() => revalidatePublicContent({ slugs: [] })), COMMON)
  assert.deepEqual(calls(() => revalidatePublicContent()), COMMON)
})

test("삭제 등 slug 1건 + null/undefined/중복 정리", () => {
  assert.deepEqual(calls(() => revalidatePublicContent({ slugs: ["gone-slug-abc123"] })), [...COMMON, ["/insights/gone-slug-abc123"]])
  assert.deepEqual(calls(() => revalidatePublicContent({ slugs: ["a", null, undefined, "", "a"] })), [...COMMON, ["/insights/a"]])
})

test("소스 전체에 상세 route 패턴 전체 무효화 호출이 없다", async () => {
  const hits = []
  async function walk(dir) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) await walk(p)
      else if (/\.(ts|tsx)$/.test(ent.name)) {
        const src = await fs.readFile(p, "utf8")
        // 주석 줄은 제외하고 실제 호출만 본다
        const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")
        if (/revalidatePath\(\s*["'`]\/insights\/\[slug\]/.test(code)) hits.push(p)
      }
    }
  }
  await walk(path.resolve("src"))
  assert.deepEqual(hits, [])
})

test("cron/collect: 새로 공개한 글이 0건이면 무효화를 호출하지 않는다 (ids.length > 0 블록 안)", async () => {
  const src = await fs.readFile("src/app/api/cron/collect/route.ts", "utf8")
  const guard = src.indexOf("if (ids.length > 0)")
  const call = src.indexOf("revalidatePublicContent({ slugs:")
  assert.ok(guard > 0 && call > guard, "revalidate 호출이 ids.length > 0 가드 안에 있어야 한다")
})
