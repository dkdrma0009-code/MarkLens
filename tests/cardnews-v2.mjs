// Run: node tests/cardnews-v2.mjs [--serve]. Only mocked DB/AI are used.
import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import http from "node:http"
import esbuild from "esbuild"
import sharp from "sharp"
import JSZip from "jszip"
import { ImageResponse } from "next/og.js"
import fixtures from "./fixtures/cardnews-v2.cjs"
const requireBundle = createRequire(import.meta.url)
const out = path.resolve(".next/phase5-verification")
const actionIds = card => (card.slides.find(s => s.role === "action")?.body ?? "").split("\n").filter(Boolean).map((_, i) => i + 1)

const mocks = {
  name: "local-qa-only",
  setup(build) {
    build.onResolve({ filter: /^@\/lib\/supabase\/(admin|server)$/ }, args => ({ path: args.path, namespace: "qa" }))
    build.onResolve({ filter: /^@\/lib\/ai\/gemini$/ }, args => ({ path: args.path, namespace: "qa" }))
    build.onLoad({ filter: /.*/, namespace: "qa" }, args => ({ contents: args.path.includes("gemini")
      ? "exports.geminiJson = async () => globalThis.qaAI.shift()"
      : args.path.endsWith("server") ? "exports.createClient=async()=>({auth:{getUser:async()=>({data:{user:{email:'qa@example.test'}}})}})"
        : `exports.createAdminClient=()=>({from(table){const q={select(){return q},eq(){return q},single:async()=>({data:globalThis.qaDB[table]}),upsert:async(row)=>{globalThis.qaWrites.push({table,row});globalThis.qaDB[table]={...globalThis.qaDB[table],...row};return {}},update:()=>q,then(resolve){resolve({})}};return q}})` }))
  },
}

async function bundle(entry, name, extra = {}) {
  await esbuild.build({ entryPoints: [entry], outfile: path.join(out, `${name}.cjs`), bundle: true, platform: "node", packages: "external", jsx: "automatic", plugins: [mocks], ...extra })
  return requireBundle(path.join(out, `${name}.cjs`))
}

async function main() {
  await fs.mkdir(out, { recursive: true })
  const { validateCardnews } = await bundle("src/lib/cardnews/validate.ts", "validate")
  const { sourceMetric, visualFamily, editorialLines } = await bundle("src/lib/cardnews/editorial.ts", "editorial")
  const { renderSlide } = await bundle("src/lib/cardnews/templates.tsx", "templates")
  const { prepareEditorialContext } = await bundle("src/lib/cardnews/render-context.ts", "context")
  const { loadFonts } = await bundle("src/lib/cardnews/fonts.ts", "fonts")
  const { GET: preview } = await bundle("src/app/api/admin/cardnews/render/route.tsx", "preview")
  const { GET: download } = await bundle("src/app/api/admin/cardnews/download/route.tsx", "download")
  const { POST: generate } = await bundle("src/app/api/admin/cardnews/generate/route.ts", "generate")
  const { POST: save } = await bundle("src/app/api/admin/cardnews/save/route.ts", "save")
  const { renderCardnewsBuffers } = await bundle("src/lib/cardnews/render-buffers.ts", "buffers")
  const fonts = await loadFonts()
  process.env.ADMIN_EMAIL = "qa@example.test"
  delete process.env.N8N_WEBHOOK_SECRET
  globalThis.qaWrites = []
  const imagePath = path.join(out, "article-image.jpg")
  // A clean checkout can run the regression suite without network access. The
  // reviewed deliverables use the separately supplied published campaign image.
  if (!await fs.stat(imagePath).catch(() => null))
    await sharp({ create: { width: 1024, height: 512, channels: 3, background: "#989E8D" } }).jpeg().toFile(imagePath)
  const imageBytes = await fs.readFile(imagePath)
  const image = `data:image/jpeg;base64,${imageBytes.toString("base64")}`
  const numeric = fixtures.data.slides[2].body
  const articleFor = name => ({ image_url: ["noImage", "typography", "missing", "data", "longData"].includes(name) ? null : image,
    source_name: "Local QA fixture — not published statistics", published_at: "2026-10-08", raw_content: name === "data" || name === "longData" ? fixtures[name].slides[2].body : "", fallback_image: null })
  let liveFixtures = null
  const selectFixture = name => {
    const card = liveFixtures?.[name] ?? fixtures[name]
    globalThis.qaDB = { cardnews: { ...card, caption: "Local fixture only" }, articles: articleFor(name), insights: { slug: `fixture-${name}`, hook: "테스트", category: card.category, summary: "검증용 요약", why_it_matters: "검증용 해석", practical_applications: card.slides.find(s => s.type === "apply")?.body ?? "", key_takeaways: [] } }
    return card
  }
  for (const [name, card] of Object.entries(fixtures)) {
    const errors = validateCardnews(card)
    if (name === "long") assert.ok(errors.length > 0, "Long manual copy must warn, but safely render")
    else assert.deepEqual(errors, [], `${name} validation`)
  }
  for (const count of [4, 8]) assert.ok(validateCardnews({ category: "test", slides: Array.from({ length: count }, () => fixtures.photo.slides[0]) }).length)
  assert.deepEqual(validateCardnews({ ...fixtures.photo, slides: fixtures.photo.slides.filter(s => s.role !== "end") }), [])
  const reordered = structuredClone(fixtures.photo)
  ;[reordered.slides[3], reordered.slides[4]] = [reordered.slides[4], reordered.slides[3]]
  assert.ok(validateCardnews(reordered).length)
  const mixed = structuredClone(fixtures.photo); delete mixed.slides[2].role
  assert.ok(validateCardnews(mixed).length)
  const duplicate = structuredClone(fixtures.photo); duplicate.slides[4].body = duplicate.slides[3].body
  assert.ok(validateCardnews(duplicate).length)
  assert.equal(sourceMetric(fixtures.data.slides, "An unrelated 84%", "Source", "2026-10-08"), null)
  assert.equal(sourceMetric(fixtures.data.slides, numeric, "", "2026-10-08"), null)
  assert.equal(sourceMetric(fixtures.data.slides, numeric, "Source", ""), null)
  const metric = sourceMetric(fixtures.data.slides, numeric, "Fixture", "2026-10-08")
  assert.equal(metric.value, "84%")
  assert.equal(sourceMetric(fixtures.longData.slides, fixtures.longData.slides[2].body, "Fixture", "2026-10-08").value, "123,456,789명")
  assert.deepEqual(editorialLines("123,456,789건", 952 / 80, 1), ["123,456,789건"])
  assert.equal(visualFamily("커리어", fixtures.typography.slides, true, metric), "typography")
  assert.equal(visualFamily("캠페인", fixtures.photo.slides, true, null), "photo")
  assert.equal(visualFamily("데이터", fixtures.data.slides, false, metric), "data")
  const independentContext = { ...fixtures.data.slides[2], body: "독립적인맥락" }
  assert.ok(JSON.stringify(renderSlide(independentContext, "데이터", 7, { page: 3, editorial: { family: "data", metric } })).includes("독립적인맥락"), "A different context must not be replaced by the selected numeric statement")
  for (const text of ['긴한국어제목'.repeat(30), 'InternationalBrandName123,456,789%'.repeat(10), '"따옴표" 100% 한국어와 English', '🇰🇷é'.repeat(50)]) {
    const lines = editorialLines(text, 13, 4)
    assert.ok(lines.length <= 4)
    assert.ok(!lines.join("").includes("\uFFFD"))
  }

  const manifest = []
  for (const [name, card] of Object.entries(fixtures)) {
    selectFixture(name)
    const ctx = await prepareEditorialContext(card.slides, card.category, articleFor(name))
    const rendered = await renderCardnewsBuffers(name)
    assert.equal(rendered.buffers.length, card.slides.length)
    for (let i = 0; i < card.slides.length; i++) {
      const request = new Request(`http://qa.test/api/admin/cardnews/render?articleId=${name}&slide=${i + 1}`)
      const response = await preview(request)
      assert.equal(response.status, 200)
      const png = Buffer.from(await response.arrayBuffer())
      assert.ok(png.equals(rendered.buffers[i]), `${name} preview/publish image equality slide ${i + 1}`)
      const direct = Buffer.from(await new ImageResponse(renderSlide(card.slides[i], card.category, card.slides.length,
        { page: i + 1, editorial: ctx, coverImage: !ctx && i === 0 ? image : null }), { width: 1080, height: 1350, fonts }).arrayBuffer())
      assert.ok(png.equals(direct))
      const meta = await sharp(png).metadata()
      assert.equal(meta.width, 1080); assert.equal(meta.height, 1350)
      const file = `${name}-${String(i + 1).padStart(2, "0")}.png`
      await fs.writeFile(path.join(out, file), png)
    }
    manifest.push({ fixture: name, count: card.slides.length, family: ctx?.family ?? "legacy", validation: name === "long" ? "expected length warnings" : "PASS" })
  }
  // Legacy output must be byte-identical to the pre-Phase-5 renderer.
  const original = execFileSync("git", ["show", "HEAD:src/lib/cardnews/templates.tsx"], { encoding: "utf8" })
  const previous = await bundle("src/lib/cardnews/templates.tsx", "legacy-original", { entryPoints: undefined, stdin: { contents: original, resolveDir: path.resolve("src/lib/cardnews"), loader: "tsx" } })
  for (let i = 0; i < fixtures.legacy.slides.length; i++) {
    const buffer = Buffer.from(await new ImageResponse(previous.renderSlide(fixtures.legacy.slides[i], fixtures.legacy.category, 6, { coverImage: i === 0 ? image : null }), { width: 1080, height: 1350, fonts }).arrayBuffer())
    assert.ok(buffer.equals(await fs.readFile(path.join(out, `legacy-${String(i + 1).padStart(2, "0")}.png`))))
  }
  for (const name of ["typography", "legacy", "photo"]) {
    const card = selectFixture(name)
    const saved = await save(new Request("http://qa.test/save", { method: "POST", body: JSON.stringify({ articleId: name, slides: card.slides, category: card.category }) }))
    assert.equal(saved.status, 200)
    assert.deepEqual((await saved.json()).warnings, [])
    const response = await download(new Request(`http://qa.test/download?articleId=${name}`))
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    assert.equal(Object.keys(zip.files).length, card.slides.length)
    for (const [i, file] of Object.values(zip.files).entries()) assert.ok((await file.async("nodebuffer")).equals(await fs.readFile(path.join(out, `${name}-${String(i + 1).padStart(2, "0")}.png`))))
    // Full generation and regeneration use mock AI; writes go to an in-memory array.
    globalThis.qaAI = [{ ...structuredClone(card), actionSourceIds: actionIds(card) }, { caption: "QA" }]
    if (name !== "legacy") {
      const result = await generate(new Request("http://qa.test/generate", { method: "POST", body: JSON.stringify({ articleId: name }) }))
      assert.equal(result.status, 200)
      const generated = await result.json()
      assert.equal(generated.slides.length, card.slides.length)
      assert.equal("actionSourceIds" in generated, false, "Grounding IDs must not change the API contract")
      assert.ok(generated.slides.every(s => !("actionSourceIds" in s)), "Internal IDs must not be persisted inside slides")
    }
    globalThis.qaAI = [{ slide: { ...card.slides.at(-1), role: undefined }, actionSourceIds: actionIds(card) }]
    const result = await generate(new Request("http://qa.test/generate", { method: "POST", body: JSON.stringify({ articleId: name, slide: card.slides.length }) }))
    assert.equal(result.status, 200)
    assert.equal((await result.json()).slides.at(-1).role, card.slides.at(-1).role)
  }
  // Both full generation and single regeneration must reject expanded actions
  // before any DB upsert. The mock DB is isolated from every production client.
  selectFixture("photo")
  globalThis.qaDB.insights.practical_applications = "지역 예술가와 협업하세요."
  globalThis.qaDB.cardnews.slides = structuredClone(fixtures.photo.slides)
  globalThis.qaWrites = []
  const inflated = { ...structuredClone(fixtures.photo), actionSourceIds: [1, 1, 1] }
  globalThis.qaAI = [inflated, inflated, { caption: "QA" }]
  assert.equal((await generate(new Request("http://qa.test/generate", { method: "POST", body: JSON.stringify({ articleId: "photo" }) }))).status, 422)
  assert.equal(globalThis.qaWrites.length, 0)
  const actionIndex = fixtures.photo.slides.findIndex(s => s.role === "action")
  const invalidAction = structuredClone(fixtures.photo.slides[actionIndex])
  globalThis.qaAI = [{ slide: invalidAction, actionSourceIds: [1, 1, 1] }, { candidates: [invalidAction] }]
  assert.equal((await generate(new Request("http://qa.test/generate", { method: "POST", body: JSON.stringify({ articleId: "photo", slide: actionIndex + 1 }) }))).status, 422)
  assert.equal(globalThis.qaWrites.length, 0)
  selectFixture("legacy")
  assert.equal((await preview(new Request("http://qa.test/preview?articleId=legacy&slide=7"))).status, 404)
  assert.equal((await generate(new Request("http://qa.test/generate", { method: "POST", body: JSON.stringify({ articleId: "legacy", slide: 7 }) }))).status, 400)
  process.env.ADMIN_EMAIL = "other@example.test"
  assert.equal((await preview(new Request("http://qa.test/preview?articleId=photo"))).status, 401)
  process.env.ADMIN_EMAIL = "qa@example.test"
  await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2))
  const covers = await Promise.all(["photo", "data", "typography"].map(name => sharp(path.join(out, `${name}-01.png`)).resize(360, 450).toBuffer()))
  await sharp({ create: { width: 1080, height: 450, channels: 3, background: "#101010" } }).composite(covers.map((input, i) => ({ input, left: i * 360, top: 0 }))).png().toFile(path.join(out, "feed-preview.png"))
  for (const [name, selected] of Object.entries({ photo: [1, 2, 5, 6, 7], data: [1, 3, 5], typography: [1, 5] })) {
    const images = await Promise.all(selected.map(i => sharp(path.join(out, `${name}-${String(i).padStart(2, "0")}.png`)).resize(360, 450).toBuffer()))
    await sharp({ create: { width: images.length * 360, height: 450, channels: 3, background: "#101010" } }).composite(images.map((input, i) => ({ input, left: i * 360, top: 0 }))).png().toFile(path.join(out, `${name}-selected.png`))
  }
  console.log(JSON.stringify({ result: "PASS", fixtures: manifest, checks: "validation, role order, duplicates, numeric provenance, typography caps, all PNG sizes, preview/render/publish buffer equality, legacy exact PNG equality, 5/6/7 ZIP, mocked generation/regeneration, auth and range" }))

  if (process.argv.includes("--serve")) {
    liveFixtures = structuredClone(fixtures)
    http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1:3002")
      if (req.method === "POST" && ["/api/admin/cardnews/save", "/api/admin/cardnews/generate"].includes(url.pathname)) {
        let body = ""; for await (const chunk of req) body += chunk
        const payload = JSON.parse(body)
        if (!liveFixtures[payload.articleId]) { res.writeHead(404); res.end(); return }
        const card = selectFixture(payload.articleId)
        globalThis.qaAI = payload.slide ? [{ slide: structuredClone(card.slides[payload.slide - 1]), actionSourceIds: actionIds(card) }] : [{ ...structuredClone(card), actionSourceIds: actionIds(card) }, { caption: "Local QA fixture only" }]
        const response = await (url.pathname.endsWith("save") ? save : generate)(new Request(url, { method: "POST", body }))
        liveFixtures[payload.articleId] = globalThis.qaDB.cardnews
        res.writeHead(response.status, { "content-type": "application/json" }); res.end(await response.text()); return
      }
      if (req.method !== "GET") { res.writeHead(405); res.end("Production operations blocked"); return }
      if (url.pathname === "/api/admin/cardnews/render") {
        const name = url.searchParams.get("articleId")
        if (!fixtures[name]) { res.writeHead(404); res.end(); return }
        selectFixture(name)
        const response = await preview(new Request(url))
        res.writeHead(response.status, { "content-type": response.headers.get("content-type") })
        res.end(Buffer.from(await response.arrayBuffer())); return
      }
      if (url.pathname === "/api/admin/cardnews/download") {
        const name = url.searchParams.get("articleId")
        if (!liveFixtures[name]) { res.writeHead(404); res.end(); return }
        selectFixture(name)
        const response = await download(new Request(url))
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return
      }
      if (url.pathname === "/studio.js") { res.setHeader("content-type", "text/javascript"); res.end(await fs.readFile(path.join(out, "studio.js"))); return }
      if (url.pathname === "/studio.css") { res.setHeader("content-type", "text/css"); res.end(await fs.readFile(path.join(out, "studio.css"))); return }
      if (url.pathname === "/studio") { res.setHeader("content-type", "text/html; charset=utf-8"); res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/studio.css"><div id="root"></div><script src="/studio.js"></script>'); return }
      if (url.pathname === "/") { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(`<h1>Local QA — no publishing</h1>${manifest.map(f => `<a href="/studio?fixture=${f.fixture}">${f.fixture} (${f.count}) admin studio</a><br>`).join("")}`); return }
      res.writeHead(405); res.end("QA server blocks every production operation")
    }).listen(3002, "127.0.0.1", () => console.log("Safe mocked admin preview: http://127.0.0.1:3002/"))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
