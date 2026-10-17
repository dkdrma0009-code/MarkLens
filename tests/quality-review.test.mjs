import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { brandWatchFindings, collectBrandWatch, insightFindings, loadSource, mentionedDays, openLaunchDatabase } from '../tools/quality-review/content.mjs'

// Quality Review V1 validation set: known problems must be caught, known-good states must stay quiet.
const NOW = '2026-10-17T03:00:00Z'
const ids = list => list.map(f => `${f.level}:${f.id}`).sort()
const clone = value => structuredClone(value)

test('content: the launch dataset raises exactly the known questions and no errors', async () => {
  const handle = await openLaunchDatabase()
  try {
    const data = await collectBrandWatch(handle, NOW), list = brandWatchFindings(data)
    // MUSINSA dates shown as report dates while the movement's own text names other days → a question, never an error.
    const dates = list.filter(f => f.id === 'CONTENT-DATE-001')
    assert.deepEqual(dates.map(f => f.target), ["MUSINSA · FW '온 & 오프 페스티벌' 진행", 'MUSINSA · 오사카 첫 대형 팝업 개최 발표'])
    assert.ok(dates.every(f => f.level === 'yellow' && f.review === 'human' && f.question))
    assert.match(dates[0].message, /보도일\(10\.8\).*10\.6, 10\.19/)
    // DANGGEUN Snapshot (9.18) predates the 10.10 movement → staleness question.
    const stale = list.filter(f => f.id === 'CONTENT-SNAPSHOT-001')
    assert.equal(stale.length, 1); assert.equal(stale[0].target, '당근'); assert.match(stale[0].message, /9\.18.*10\.10/)
    // Private brands without a Snapshot and the image-less TOSS movement are fine; nothing is red.
    assert.deepEqual(ids(list), ['yellow:CONTENT-DATE-001', 'yellow:CONTENT-DATE-001', 'yellow:CONTENT-SNAPSHOT-001'])
    assert.deepEqual(data.states.filter(s => s.kind !== 'available').map(s => s.brand.slug).sort(), ['baemin', 'toss'])
  } finally { await handle.close() }
})

test('content: broken lineage, leaks and missing public pieces are caught (data changed in memory)', async () => {
  const handle = await openLaunchDatabase()
  try {
    const data = await collectBrandWatch(handle, NOW), musinsa = () => data.states.find(s => s.brand.slug === 'musinsa')
    // The database itself refuses to change published lineage; these cases simulate rows that got in some other way.
    await assert.rejects(handle.db.query(`DELETE FROM pattern_movements WHERE pattern_id = (SELECT id FROM brand_patterns WHERE status = 'published' LIMIT 1)`), /immutable/)
    // 1. Pattern with a single supporting movement.
    let states = clone(data.states); states.find(s => s.brand.slug === 'musinsa').patterns[0].movementAnchors.splice(1)
    assert.ok(brandWatchFindings({ ...data, states }).some(f => f.id === 'CONTENT-PATTERN-001' && f.level === 'red'))
    // 2. The same break in the stored lineage, judged by the real health evaluator.
    const { loadLineageGraph } = loadSource('src/lib/brand-watch/lifecycle/load.ts'), { evaluateLineageHealth } = loadSource('src/lib/brand-watch/lifecycle/health.ts')
    const graph = await loadLineageGraph(handle.queryClient, handle.entityId('musinsa'))
    graph.patterns.find(p => p.status === 'published').movementIds.splice(1)
    const broken = brandWatchFindings({ ...data, lineage: [{ slug: 'musinsa', results: evaluateLineageHealth(graph, NOW).results }] })
    assert.ok(broken.some(f => f.id === 'CONTENT-LINEAGE-001' && f.level === 'red' && /INSUFFICIENT_INDEPENDENT_MOVEMENTS/.test(f.message)))
    // 3. Rejected Evidence leaking into a public movement.
    const factId = musinsa().movements[0].facts[0].id, evidence = new Map(data.evidence)
    evidence.set(factId, { ...evidence.get(factId), review_status: 'rejected' })
    assert.ok(brandWatchFindings({ ...data, evidence }).some(f => f.id === 'CONTENT-LEAK-002' && f.level === 'red'))
    // 4. An internal field in the public read model.
    states = clone(data.states); states.find(s => s.brand.slug === 'musinsa').movements[0].confidence = 0.92
    assert.ok(brandWatchFindings({ ...data, states }).some(f => f.id === 'CONTENT-LEAK-001' && f.level === 'red' && /confidence/.test(f.message)))
    // 5. A public brand without a Snapshot is a question; a Take with an empty part is an error.
    states = clone(data.states); states.find(s => s.brand.slug === 'musinsa').snapshot = null; states.find(s => s.brand.slug === 'musinsa').takes[0].whyItMayMatter = ' '
    const list = brandWatchFindings({ ...data, states })
    assert.ok(list.some(f => f.id === 'CONTENT-SNAPSHOT-002' && f.level === 'yellow')); assert.ok(list.some(f => f.id === 'CONTENT-TAKE-001' && f.level === 'red'))
    // 6. A movement without an image is never a finding.
    states = clone(data.states); states.find(s => s.brand.slug === 'musinsa').movements.forEach(m => { m.visual = null })
    assert.deepEqual(ids(brandWatchFindings({ ...data, states })), ids(brandWatchFindings(data)))
  } finally { await handle.close() }
})

test('content: Insights structure uses only real public fields and ignores unpublished rows', () => {
  const article = { title: '원문 제목', source_name: 'HubSpot', url: 'https://example.com/a', image_url: 'https://images.example.com/a.jpg', fallback_image: null, status: 'published' }
  const ok = { slug: 'a', legacy_slug: null, hook: '훅', summary: '요약', category: '브랜딩', article }
  assert.deepEqual(insightFindings([ok]).findings, [])
  const rows = [ok, { ...ok, legacy_slug: 'old' }, { ...ok, slug: 'b', summary: '' }, { ...ok, slug: 'c', article: { ...article, image_url: null } },
    { ...ok, slug: 'd', article: { ...article, image_url: 'https://blocked.example/x.jpg' } }, { ...ok, slug: 'e', hook: null, article: { ...article, title: '', status: 'pending' } }]
  const { findings, publicCount } = insightFindings(rows, { isHotlinkBlocked: url => url.includes('blocked') })
  assert.equal(publicCount, 5)
  assert.deepEqual(findings.map(f => `${f.level}:${f.id}:${f.target}`).sort(), [
    'red:INSIGHT-SLUG-001:인사이트 a', 'yellow:INSIGHT-CONTENT-002:인사이트 b', 'yellow:INSIGHT-IMAGE-001:인사이트 c', 'yellow:INSIGHT-IMAGE-001:인사이트 d'])
})

test('content: only explicit day mentions are compared', () => {
  assert.deepEqual([...mentionedDays("'온&오프 페스티벌 2026.10.06 - 10.19' 포스터, 10월 19일까지, 약 2.8배, 15일")], ['10.6', '10.19'])
})

const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
test('design: known problems are reported with rule ids, a clean page passes', { skip: !existsSync(chrome) && 'Chrome is not installed' }, () => {
  const out = mkdtempSync(path.join(os.tmpdir(), 'qr-design-'))
  try {
    const page = name => `${name}=${pathToFileURL(path.resolve(`tests/fixtures/quality-review/design-${name}.html`)).href}`
    execFileSync(process.execPath, ['tools/design-audit.mjs', '--no-shots', '--widths', '1440', '--port', '9391', '--out', out, page('problems'), page('clean')], { stdio: 'pipe', env: { ...process.env, CHROME_PATH: chrome } })
    const [problems, clean] = JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8'))
    const fired = new Set(problems.checks.map(check => check.id))
    for (const id of ['FUNC-IMAGE-003', 'FUNC-IMAGE-001', 'DESIGN-TEXT-002', 'DESIGN-TEXT-001']) assert.ok(fired.has(id), id)
    assert.equal(problems.result, 'FAIL')
    assert.equal(clean.result, 'PASS', JSON.stringify(clean.checks))
  } finally { rmSync(out, { recursive: true, force: true }) }
})
