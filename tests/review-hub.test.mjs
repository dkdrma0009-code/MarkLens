import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyKnown, keyOf, kindOf, reviewItems, scopeOf } from '../tools/quality-review/queue.mjs'
import { applyLocal, dashboard, markdown, body, parseRecord, planSync, recordText } from '../tools/review-hub/hub.mjs'
import { notionClient, toNotionProperties } from '../tools/review-hub/notion.mjs'

// Review Hub V1: Quality Review items → Notion pages. Same report twice = no duplicates; state changes move the same page.
const NOW = '2026-10-18T03:00:00.000Z', LATER = '2026-10-19T03:00:00.000Z'
const prep = (list, dataScope = 'REAL') => list.map(f => ({ area: 'design', review: 'auto', ...f, key: keyOf(f), kind: kindOf(f), scope: scopeOf(f, dataScope) }))
const date = { id: 'CONTENT-DATE-001', area: 'content', level: 'yellow', target: "MUSINSA · FW '온 & 오프 페스티벌' 진행", place: '무신사', message: '날짜', evidence: { shown: '2026-10-08', mentioned: ['10.6', '10.19'] } }
const snap = { id: 'CONTENT-SNAPSHOT-001', area: 'content', level: 'yellow', target: '당근', place: '당근', message: 'Snapshot', evidence: { asOf: '2026-09-18', newer: [{ date: '2026-10-10', title: "첫 중고거래 행사 '당근절' 개최" }] } }
const text = (target, place, texts) => ({ id: 'DESIGN-TEXT-001', level: 'yellow', target, place, message: `${texts.length}개`, label: '작은 글자를 최소 기준(11px) 이상으로 올려야 합니다', evidence: { count: texts.length, texts } })
const findings = () => prep([date, snap, text('홈 @390', '홈', ['THE MAIN STORY', '↗']), text('브랜드 목록 @1440', 'Brand Watch', ['Brand', 'Moves'])])
const sample = prep([{ id: 'DESIGN-IMAGE-001', level: 'yellow', target: '홈 @1440', place: '홈', message: '2×', label: '같은 사진' }], 'LOCAL_SAMPLE')
const fixture = prep([{ id: 'DESIGN-TEXT-002', level: 'yellow', target: 'file:///x.html @1440', message: '한글' }], 'TEST_FIXTURE')
const items = (known = [], extra = [], now = NOW) => reviewItems(applyKnown([...findings(), ...extra], known).findings, { now })
// The checks of a complete Quality Review run (names as tools/quality-review.mjs writes them).
const RAN = ['Brand Watch (출시 데이터 5개 브랜드)', 'Insights (로컬 데이터)', '테스트 · 캐시·갱신', '페이지 응답', '화면 자동 검수 (1440 · 390)', '캐시 설정'].map(name => ({ name, status: 'PASS' }))
const sync = (pages, list, now = NOW, sections = RAN) => { const plan = planSync(list, pages, { now, sections }); return { ...plan, pages: applyLocal(pages, plan.ops, { now }) } }
const deferText = [{ id: 'DESIGN-TEXT-001', title: '작은 글자', match: {}, status: 'DEFERRED', reason: '나중에' }]

test('hub: the three current items become three pages with plain Korean, and nothing else is created', () => {
  const list = items([], [...sample, ...fixture])
  const { counts, ops, pages } = sync([], list)
  assert.deepEqual(counts, { CREATE: 3, UPDATE: 0, REOPEN: 0, CLOSE: 0, TOUCH: 0 })
  assert.deepEqual(ops.map(op => [op.properties['제목'], op.properties['상태'], op.properties['종류'], op.properties['중요도']]), [
    ["무신사 「FW '온 & 오프 페스티벌' 진행」 날짜 기준 정하기", '결정 필요', '결정', '확인 필요'],
    ['당근 Snapshot을 갱신할까요?', '결정 필요', '결정', '확인 필요'],
    ['작은 글자를 최소 기준(11px) 이상으로 올려야 합니다', '할 일', '수정', '확인 필요']])
  const [dateOp, snapOp, textOp] = ops
  assert.equal(dateOp.properties['선택지'], '보도일 유지 / 행사 날짜 사용 / 나중에 결정'); assert.equal(dateOp.properties['추천'], '')
  assert.match(snapOp.properties['추천'], /^다음 정기 갱신 — .*90일/); assert.deepEqual(textOp.properties['대상'], ['홈', 'Brand Watch'])
  // The visible parts carry no rule ids or enums; those live in the details toggle.
  const visible = JSON.stringify(ops.map(op => [op.properties['제목'], op.properties['이유'], op.properties['선택지'], op.body.main]))
  assert.doesNotMatch(visible, /CONTENT-|DESIGN-|DECISION|OPEN|LOCAL_SAMPLE|Evidence|Lineage/)
  assert.match(markdown(body(list[0])), /<summary>자세히 보기<\/summary>[\s\S]*CONTENT-DATE-001/)
  assert.match(dashboard(pages, { runAt: NOW, mode: 'quick' }), /🔴 꼭 수정 0 · 🟡 내가 결정 2 · 🔧 할 일 1/)
})

test('hub: the same report twice creates nothing new (only the check time moves)', () => {
  const first = sync([], items()), second = sync(first.pages, items())
  assert.deepEqual(second.counts, { CREATE: 0, UPDATE: 0, REOPEN: 0, CLOSE: 0, TOUCH: 3 })
  assert.equal(second.pages.length, 3)
  // A new page on the same rule (more places) updates the same item instead of creating one.
  const grown = sync(second.pages, items([], prep([text('인사이트 목록 @390', '인사이트', ['퍼포먼스'])])))
  assert.deepEqual([grown.counts.CREATE, grown.counts.UPDATE], [0, 1]); assert.equal(grown.pages.length, 3)
})

test('hub: deferring and reopening move the same page; a person\'s status and decision are kept', () => {
  const start = sync([], items()).pages, textPage = () => pages.find(p => p.key === 'DESIGN-TEXT-001')
  let pages = sync(start, items(deferText)).pages
  assert.equal(textPage().status, '보류'); assert.equal(pages.length, 3)
  pages = sync(pages, items()).pages
  assert.equal(textPage().status, '할 일'); assert.equal(pages.length, 3)
  // A person marks the action in progress: an unchanged review leaves it alone.
  textPage().status = '진행 중'
  assert.equal(sync(pages, items()).pages.find(p => p.key === 'DESIGN-TEXT-001').status, '진행 중')
  // A person records a decision: it becomes a to-do (or deferred for "later"); nothing is executed.
  const snapPage = pages.find(p => p.key.startsWith('CONTENT-SNAPSHOT-001')); snapPage.decision = '지금 갱신'
  const decided = sync(pages, items())
  assert.equal(decided.pages.find(p => p.key === snapPage.key).status, '할 일'); assert.match(decided.ops.find(op => op.key === snapPage.key).note, /결정 기록: 지금 갱신/)
})

test('hub: a solved problem is closed as done (never deleted) and reopens when it returns', () => {
  let pages = sync([], items()).pages
  const solved = reviewItems(applyKnown(prep([date, snap]), []).findings, { now: LATER }) // small text fixed
  const closed = sync(pages, solved, LATER)
  assert.equal(closed.counts.CLOSE, 1); assert.equal(closed.pages.length, 3)
  assert.equal(closed.pages.find(p => p.key === 'DESIGN-TEXT-001').status, '완료')
  pages = closed.pages
  const back = sync(pages, items([], [], LATER), LATER)
  assert.equal(back.counts.REOPEN, 1); assert.equal(back.counts.CREATE, 0)
  const page = back.pages.find(p => p.key === 'DESIGN-TEXT-001')
  assert.equal(page.status, '할 일'); assert.ok(page.notes.some(note => note.startsWith('다시 발견됨')))
})

test('hub: a red failure always comes back to the top, even from 보류', () => {
  const broken = prep([{ id: 'FUNC-IMAGE-003', area: 'functional', level: 'red', target: '홈 @1440', place: '홈', message: '1' }])
  let pages = sync([], items([], broken)).pages
  assert.equal(pages.find(p => p.key === 'FUNC-IMAGE-003').status, '할 일')
  pages.find(p => p.key === 'FUNC-IMAGE-003').status = '보류'
  const again = sync(pages, items([{ id: 'FUNC-IMAGE-003', title: 'x', match: {}, status: 'DEFERRED', reason: 'x' }], broken))
  assert.equal(again.ops.find(op => op.key === 'FUNC-IMAGE-003').op, 'REOPEN')
  assert.equal(items([], broken)[0].key, 'FUNC-IMAGE-003') // listed first
})

test('hub: the Notion adapter sends plain properties and never prints the token', async () => {
  const calls = [], fetchImpl = async (url, init) => { calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body) }); return { ok: true, json: async () => ({ results: [], has_more: false }) } }
  const client = notionClient({ token: 'secret-token', databaseId: 'db-1', fetchImpl })
  const { ops } = planSync(items(), [], { now: NOW })
  await client.apply(ops[0])
  assert.equal(calls[0].url, 'https://api.notion.com/v1/pages'); assert.equal(calls[0].body.parent.database_id, 'db-1')
  assert.deepEqual(calls[0].body.properties['상태'], { select: { name: '결정 필요' } }); assert.equal(calls[0].body.properties['대상'].multi_select[0].name, '무신사')
  assert.ok(calls[0].body.children.some(block => block.toggle))
  assert.deepEqual(toNotionProperties({ '마지막 확인': NOW }), { '마지막 확인': { date: { start: NOW } } })
  // The review record is plain text (Notion connectors reject JSON-looking values) and reads back to the same record.
  assert.match(ops[0].properties['검수 기록'], /^s=OPEN h=[0-9a-f]{12}$/)
  assert.deepEqual(parseRecord(recordText({ s: 'RESOLVED', h: null })), { s: 'RESOLVED', h: null }); assert.equal(parseRecord('메모'), null)
  const failing = notionClient({ token: 'secret-token', databaseId: 'db-1', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ code: 'unauthorized' }) }) })
  await assert.rejects(failing.pages(), error => !error.message.includes('secret-token') && /401/.test(error.message))
})

test('hub: a page is never closed when the check that would find it did not run (skipped, crashed or unknown)', () => {
  const pages = sync([], items()).pages, contentOnly = reviewItems(applyKnown(prep([date, snap]), []).findings, { now: LATER })
  for (const sections of [RAN.map(s => s.name.startsWith('화면') ? { ...s, status: 'SKIPPED' } : s), RAN.map(s => s.name.startsWith('화면') ? { ...s, status: 'ERROR' } : s), RAN.filter(s => !s.name.startsWith('화면')), null]) {
    const plan = planSync(contentOnly, pages, { now: LATER, sections })
    assert.equal(plan.counts.CLOSE, 0); assert.deepEqual(plan.held.map(page => page.key), ['DESIGN-TEXT-001'])
  }
  // With the design check run to the end, the same report does close it.
  assert.equal(planSync(contentOnly, pages, { now: LATER, sections: RAN }).counts.CLOSE, 1)
})
