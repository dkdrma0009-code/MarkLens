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
    // MUSINSA On&Off shows its report date while its own text names an earlier day → a question, never an error.
    // The Osaka pop-up is an announcement: its date is the announcement day and later days are the plan → a note only.
    const dates = list.filter(f => f.id === 'CONTENT-DATE-001')
    assert.deepEqual(dates.map(f => `${f.level}:${f.target}`), ["yellow:MUSINSA · FW '온 & 오프 페스티벌' 진행", 'info:MUSINSA · 오사카 첫 대형 팝업 개최 발표'])
    assert.ok(dates[0].review === 'human' && dates[0].question)
    assert.match(dates[0].message, /보도일\(10\.8\).*10\.6, 10\.19/); assert.deepEqual(dates[0].evidence, { shown: '2026-10-08', mentioned: ['10.6', '10.19'] })
    // DANGGEUN Snapshot (9.18) predates the 10.10 movement → staleness question.
    const stale = list.filter(f => f.id === 'CONTENT-SNAPSHOT-001')
    assert.equal(stale.length, 1); assert.equal(stale[0].target, '당근'); assert.match(stale[0].message, /9\.18.*10\.10/)
    // Private brands without a Snapshot and the image-less TOSS movement are fine; nothing is red.
    assert.deepEqual(ids(list), ['info:CONTENT-DATE-001', 'yellow:CONTENT-DATE-001', 'yellow:CONTENT-SNAPSHOT-001'])
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

// ---------- Human queue (V1.1) ----------
const { applyKnown, buildQueue, keyOf, kindOf, scopeOf } = await import('../tools/quality-review/queue.mjs')
const prep = (list, dataScope = 'REAL') => list.map(f => ({ area: 'design', review: 'auto', ...f, key: keyOf(f), kind: kindOf(f), scope: scopeOf(f, dataScope) }))
const footer = { id: 'DESIGN-TEXT-001', level: 'yellow', target: '당근 @1440', message: '2개', label: '작은 글자', evidence: { count: 2, texts: ['© 2026 MarkLens', 'Marketing × Trend × Intelligen'] } }
const homeText = { id: 'DESIGN-TEXT-001', level: 'yellow', target: '홈 @390', message: '58개', label: '작은 글자', evidence: { count: 58, texts: ['THE MAIN STORY', '↗', 'ON THE RADAR'] } }
const dateQ = { id: 'CONTENT-DATE-001', area: 'content', level: 'yellow', target: 'MUSINSA · 온&오프', message: '날짜', evidence: { shown: '2026-10-08', mentioned: ['10.6', '10.19'] } }
const snapQ = { id: 'CONTENT-SNAPSHOT-001', area: 'content', level: 'yellow', target: '당근', message: 'Snapshot', evidence: { asOf: '2026-09-18', newer: [{ date: '2026-10-10', title: '당근절' }] } }
const broken = { id: 'FUNC-IMAGE-003', area: 'functional', level: 'red', target: '홈 @1440', message: '1' }
const deferFooter = { id: 'DESIGN-TEXT-001', title: '하단 10px', match: { texts: ['© 2026 MarkLens', 'Marketing × Trend × Intelligen'] }, status: 'DEFERRED', reason: '나중에' }

test('queue: deferred and acknowledged findings stay in the report but leave the queue; reopening brings them back', () => {
  const findings = prep([footer, homeText, dateQ, snapQ])
  const deferred = applyKnown(findings, [deferFooter])
  assert.equal(deferred.findings.find(f => f.target === '당근 @1440').status, 'DEFERRED')
  assert.equal(deferred.findings.find(f => f.target === '홈 @390').status, 'OPEN') // other small text on the page: not hidden
  const queued = buildQueue(deferred.findings)
  assert.deepEqual(queued.map(q => q.kind), ['DECISION', 'DECISION', 'ACTION'])
  assert.ok(!queued.some(q => q.lines.some(line => line.startsWith('당근 @1440'))))
  // Reopen (entry removed): the footer page is back in the small-text item.
  const reopened = buildQueue(applyKnown(findings, []).findings)
  assert.ok(reopened.find(q => q.kind === 'ACTION').lines.some(line => line.startsWith('당근 @1440')))
  // A new small text on a deferred page means the known issue no longer covers it.
  const grown = prep([{ ...footer, evidence: { count: 3, texts: ['TINY', '© 2026 MarkLens', 'Marketing × Trend × Intelligen'] } }])
  assert.equal(applyKnown(grown, [deferFooter]).findings[0].status, 'OPEN')
})

test('queue: FAIL is never suppressed, a resolved issue that returns is reopened, and quiet entries are listed', () => {
  const known = [{ id: 'FUNC-IMAGE-003', title: '깨진 이미지', match: {}, status: 'DEFERRED', reason: 'x' }, { id: 'DESIGN-SPACE-001', title: '간격', match: {}, status: 'RESOLVED', reason: 'fixed' },
    { id: 'DESIGN-HERO-001', title: '첫 화면', match: {}, status: 'DEFERRED', reason: 'later' }]
  const { findings, quiet } = applyKnown(prep([broken, { id: 'DESIGN-SPACE-001', level: 'yellow', target: '홈 @1440', message: '300px', label: '빈 공간' }]), known)
  assert.equal(findings[0].status, 'OPEN'); assert.match(findings[0].note, /꼭 수정/)
  assert.equal(findings[1].status, 'OPEN'); assert.match(findings[1].note, /다시 나타났습니다/)
  assert.deepEqual(quiet.map(entry => entry.title), ['첫 화면'])
  assert.equal(buildQueue(findings)[0].level, 'red')
})

test('queue: sample-data findings are not asked, typography stays real, order is stable and capped at 5', () => {
  const repeat = { id: 'DESIGN-IMAGE-001', level: 'yellow', target: '홈 @1440', message: '2×', label: '같은 사진' }
  assert.equal(scopeOf(repeat, 'LOCAL_SAMPLE'), 'LOCAL_SAMPLE'); assert.equal(scopeOf(homeText, 'LOCAL_SAMPLE'), 'REAL')
  const findings = applyKnown([...prep([repeat], 'LOCAL_SAMPLE'), ...prep([homeText, snapQ, dateQ, broken])], []).findings
  const first = buildQueue(findings), again = buildQueue([...findings].reverse())
  assert.deepEqual(first.map(q => q.key), again.map(q => q.key))
  assert.deepEqual(first.map(q => `${q.level}:${q.kind}`), ['red:ACTION', 'yellow:DECISION', 'yellow:DECISION', 'yellow:ACTION'])
  assert.ok(!first.some(q => q.ids.includes('DESIGN-IMAGE-001')))
  const many = applyKnown(prep(Array.from({ length: 8 }, (_, i) => ({ id: `DESIGN-X-${i}`, level: 'yellow', target: `p${i}`, message: 'm' }))), []).findings
  assert.equal(buildQueue(many).length, 5)
  // Decisions are worded for a person, with at most three choices.
  const decision = first.find(q => q.ids.includes('CONTENT-DATE-001'))
  assert.deepEqual(decision.lines, ['현재 화면 날짜: 10월 8일 (보도일)', '본문·포스터에 적힌 다른 날짜: 10월 6일, 10월 19일']); assert.ok(decision.options.length <= 3)
})
