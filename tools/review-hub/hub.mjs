// Review Hub (pure). Turns Quality Review items (report.json → reviewItems) into Notion Review Hub operations.
// Notion records judgement and history; it never runs anything. Docs: docs/review-hub/README.md.
import { createHash } from 'node:crypto'

// What a person sees. Internal enums never reach a property value.
export const OPEN_STATUS = { DECISION: '결정 필요', REVIEW: '확인 필요', ACTION: '할 일' }
export const DONE = '완료', DEFERRED = '보류', ACKNOWLEDGED = '확인됨', DOING = '진행 중'
const KIND = { DECISION: '결정', REVIEW: '확인', ACTION: '수정' }
const LEVEL = { red: '꼭 수정', yellow: '확인 필요' }
export const desiredStatus = item => item.status === 'DEFERRED' ? DEFERRED : item.status === 'ACKNOWLEDGED' ? ACKNOWLEDGED : OPEN_STATUS[item.kind]
// Statuses a person sets; a sync keeps them while the review itself has not changed.
const PERSON_STATUSES = new Set([DOING, DEFERRED, ACKNOWLEDGED, '할 일'])

export const fingerprint = item => createHash('sha1').update(JSON.stringify([item.title, item.lines, item.why, item.options, item.recommendation, item.places, item.level, item.kind])).digest('hex').slice(0, 12)
const day = iso => iso.slice(0, 10)
// "검수 기록" property: the review status and fingerprint the page was last written with, as plain text ("s=OPEN h=…").
export const recordText = ({ s, h }) => `s=${s} h=${h ?? '-'}`
export const parseRecord = text => { const m = /^s=(\S+) h=(\S+)$/.exec(text?.trim() ?? ''); return m ? { s: m[1], h: m[2] === '-' ? null : m[2] } : null }

// Property values (Notion-neutral; the adapter maps them to API types).
export function properties(item, { now, firstSeen }) {
  return {
    '제목': item.title, '상태': desiredStatus(item), '중요도': LEVEL[item.level], '종류': KIND[item.kind], '대상': item.places,
    '이유': item.why ?? '', '추천': item.recommendation ? `${item.recommendation.choice} — ${item.recommendation.why}` : '', '선택지': item.options.join(' / '),
    '발생일': day(firstSeen ?? now), '마지막 확인': now, '고유 키': item.key, '검수 기록': recordText({ s: item.status, h: fingerprint(item) }),
  }
}

// Page body: what a person needs first, then the details in a toggle.
export function body(item) {
  const main = [...item.lines.map(line => ({ type: 'bullet', text: line })),
    ...(item.why ? [{ type: 'heading', text: '왜 확인하나요?' }, { type: 'text', text: item.why }] : []),
    ...(item.recommendation ? [{ type: 'heading', text: `추천: ${item.recommendation.choice}` }, { type: 'text', text: item.recommendation.why }] : []),
    ...(item.options.length ? [{ type: 'heading', text: '선택' }, ...item.options.map(option => ({ type: 'bullet', text: option })), { type: 'text', text: '고른 것을 "내 결정"에 적으면 상태가 바뀝니다. 실제 수정은 MarkLens 작업에서 합니다.' }] : [])]
  const details = [...item.detail.map(d => `${d.rule} · ${d.where} · ${d.message}`), ...item.known.map(text => `알고 있는 문제: ${text}`), ...(item.noRecommendation ? [`추천 없음: ${item.noRecommendation}`] : []), `고유 키: ${item.key}`]
  return { main, details }
}
export function markdown({ main, details }) {
  const lines = main.map(b => b.type === 'heading' ? `### ${b.text}` : b.type === 'bullet' ? `- ${b.text}` : b.text)
  return [...lines, '', '---', '<details>', '<summary>자세히 보기</summary>', ...details.map(text => `\t${text}`), '</details>'].join('\n')
}

// Which Quality Review check produces each rule (section names from tools/quality-review.mjs). A page can be closed
// only when its check ran to the end in this report; a skipped or crashed check proves nothing about the problem.
const SOURCE = [[/^CONTENT-/, /^Brand Watch/], [/^INSIGHT-/, /^Insights/], [/^(DESIGN-|FUNC-(IMAGE|PAGE|LAYOUT)-)/, /^화면 자동 검수/], [/^FUNC-ROUTE-/, /^페이지 응답/],
  [/^FUNC-TEST-/, /^테스트/], [/^FUNC-TYPE-/, /^TypeScript/], [/^FUNC-LINT-/, /^ESLint/], [/^FUNC-BUILD-/, /^프로덕션 빌드/], [/^FUNC-CACHE-/, /^캐시 설정/]]
export function checkedBy(sections = []) {
  return key => {
    const name = SOURCE.find(([rule]) => rule.test(key))?.[1], ran = name ? sections.filter(s => name.test(s.name)) : []
    return ran.length > 0 && ran.every(s => ['PASS', 'REVIEW', 'FAIL'].includes(s.status))
  }
}

// Plan. pages: [{ id, key, status, record: { s, h } | null, decision }]. sections: the report's checks (without them, nothing is closed).
export function planSync(items, pages, { now, sections = null }) {
  const checked = sections ? checkedBy(sections) : () => false
  const byKey = new Map(pages.map(page => [page.key, page])), ops = [], seen = new Set()
  for (const item of items) {
    seen.add(item.key)
    const page = byKey.get(item.key), props = properties(item, { now }), hash = fingerprint(item), want = desiredStatus(item)
    const preview = { key: item.key, title: item.title, status: want }
    if (!page) {
      // Only open problems get a page; an accepted issue that never needed attention stays in the report only.
      if (item.status === 'OPEN') ops.push({ op: 'CREATE', ...preview, properties: props, body: body(item) })
      continue
    }
    const record = page.record ?? {}, base = { pageId: page.id, ...preview }
    if (item.level === 'red' && [DONE, DEFERRED, ACKNOWLEDGED].includes(page.status))
      ops.push({ op: 'REOPEN', ...base, properties: { ...props, '발생일': undefined }, note: `다시 발견됨 (꼭 수정): ${day(now)}` })
    else if (page.status === DONE && item.status === 'OPEN')
      ops.push({ op: 'REOPEN', ...base, properties: { ...props, '발생일': undefined }, note: `다시 발견됨: ${day(now)}` })
    else if (record.s !== item.status)
      ops.push({ op: 'UPDATE', ...base, properties: { ...props, '발생일': undefined }, note: `검수 상태 변경: ${page.status} → ${want} (${day(now)})` })
    else if (page.decision && page.status === OPEN_STATUS.DECISION) {
      const next = page.decision === '나중에 결정' ? DEFERRED : '할 일'
      ops.push({ op: 'UPDATE', ...base, status: next, properties: { '상태': next, '마지막 확인': now }, note: `결정 기록: ${page.decision} (${day(now)})` })
    } else if (record.h !== hash)
      ops.push({ op: 'UPDATE', ...base, status: page.status, properties: { ...props, '상태': PERSON_STATUSES.has(page.status) ? page.status : want, '발생일': undefined } })
    else ops.push({ op: 'TOUCH', ...base, status: page.status, properties: { '마지막 확인': now } })
  }
  // Gone from the review: done, never deleted (the page keeps why it was changed) — but only if the check that would
  // have found it ran this time. Otherwise the page is left as it is.
  const held = []
  for (const page of pages) if (!seen.has(page.key) && page.status !== DONE) {
    if (!checked(page.key)) { held.push({ key: page.key, title: page.title, status: page.status }); continue }
    ops.push({ op: 'CLOSE', pageId: page.id, key: page.key, title: page.title, status: DONE, properties: { '상태': DONE, '마지막 확인': now, '검수 기록': recordText({ s: 'RESOLVED', h: page.record?.h }) }, note: `검수에서 더 이상 나타나지 않음: ${day(now)}` })
  }
  for (const op of ops) if (op.properties) for (const [k, v] of Object.entries(op.properties)) if (v === undefined) delete op.properties[k]
  const counts = Object.fromEntries(['CREATE', 'UPDATE', 'REOPEN', 'CLOSE', 'TOUCH'].map(name => [name, ops.filter(op => op.op === name).length]))
  return { ops, counts, held }
}

// Local hub (dry runs and tests): the same pages a Notion database would hold.
export function applyLocal(pages, ops, { now }) {
  const out = pages.map(page => ({ ...page, notes: [...(page.notes ?? [])] }))
  for (const op of ops) {
    if (op.op === 'CREATE') { out.push({ id: `local-${out.length + 1}`, key: op.key, title: op.properties['제목'], status: op.properties['상태'], importance: op.properties['중요도'], record: parseRecord(op.properties['검수 기록']), decision: null, firstSeen: op.properties['발생일'], lastSeen: now, notes: [] }); continue }
    const page = out.find(row => row.id === op.pageId)
    if (op.properties['상태']) page.status = op.properties['상태']
    if (op.properties['제목']) page.title = op.properties['제목']
    if (op.properties['중요도']) page.importance = op.properties['중요도']
    if (op.properties['검수 기록']) page.record = parseRecord(op.properties['검수 기록'])
    page.lastSeen = now
    if (op.note) page.notes.push(op.note)
  }
  return out
}

// Hub page summary: counts and the open titles, nothing else.
export function dashboard(pages, { runAt, mode }) {
  const by = status => pages.filter(page => page.status === status)
  const red = pages.filter(page => page.importance === '꼭 수정' && ![DONE, DEFERRED, ACKNOWLEDGED].includes(page.status))
  const list = rows => rows.length ? rows.map(row => `- ${row.title}`) : ['- 없음']
  return ['## 오늘 내가 볼 것', `🔴 꼭 수정 ${red.length} · 🟡 내가 결정 ${by(OPEN_STATUS.DECISION).length} · 🔧 할 일 ${by('할 일').length + by(DOING).length} · 👀 확인 ${by(OPEN_STATUS.REVIEW).length}`,
    `마지막 검수: ${new Date(runAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })} (${mode === 'full' ? '전체' : '빠른'} 검수)`, '',
    '**결정 필요**', ...list(by(OPEN_STATUS.DECISION)), '', '**할 일**', ...list([...by('할 일'), ...by(DOING)]), '', '**확인 필요**', ...list(by(OPEN_STATUS.REVIEW)), '',
    '**보류한 것**', ...list(by(DEFERRED)), '', '**최근 완료**', ...list(by(DONE).slice(-5))].join('\n')
}
