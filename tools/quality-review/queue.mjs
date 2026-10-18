// Quality Review — human queue (pure). Decides which findings are worth a person's time, in what order, and in words
// a person can act on. Known issues (docs/quality-review/known-issues.json) stop known, accepted findings from being
// asked again; a FAIL-level (red) finding is never suppressed. Docs: docs/quality-review/README.md#human-queue.

// What a person does with each rule: decide a direction, look at the result, or just fix it.
const KIND = {
  'CONTENT-DATE-001': 'DECISION', 'CONTENT-SNAPSHOT-001': 'DECISION', 'CONTENT-SNAPSHOT-002': 'DECISION',
  'CONTENT-LINEAGE-002': 'REVIEW', 'CONTENT-LINEAGE-003': 'REVIEW',
  'DESIGN-IMAGE-001': 'REVIEW', 'DESIGN-IMAGE-002': 'REVIEW', 'DESIGN-DATE-001': 'REVIEW', 'DESIGN-SPACE-001': 'REVIEW',
  'DESIGN-LENGTH-001': 'REVIEW', 'DESIGN-HERO-001': 'REVIEW', 'DESIGN-STYLE-001': 'REVIEW',
}
export const kindOf = finding => finding.level === 'red' ? 'ACTION' : KIND[finding.id] ?? 'ACTION'

// Findings that depend on the content shown (which photo, how long, which dates) inherit the scope of that content.
// Typography, layout and code findings are about the site itself and stay REAL whatever data rendered them.
const DATA_DEPENDENT = /^(DESIGN-IMAGE-00[12]|DESIGN-LENGTH-001|DESIGN-DATE-001|INSIGHT-)/
// A test page is a fixture as a whole, so every finding on it is TEST_FIXTURE whatever the rule.
export const scopeOf = (finding, dataScope = 'REAL') => dataScope === 'TEST_FIXTURE' ? 'TEST_FIXTURE' : DATA_DEPENDENT.test(finding.id) ? dataScope : 'REAL'

// Per-item rules (each date or Snapshot question is its own decision); every other rule is one item listing its places.
const PER_ITEM = new Set(['CONTENT-DATE-001', 'CONTENT-SNAPSHOT-001', 'CONTENT-SNAPSHOT-002'])
export const keyOf = finding => PER_ITEM.has(finding.id) || finding.area === 'content' ? `${finding.id}|${finding.target}` : finding.id

// Known issue entry: { id, title, status: ACKNOWLEDGED | DEFERRED | RESOLVED, reason, since,
//   match: { target?: substring, detail?: substring, texts?: [small-text samples that are all accepted] } }
export function matchesKnown(finding, entry) {
  if (entry.id !== finding.id) return false
  const m = entry.match ?? {}
  if (m.target && !finding.target.includes(m.target)) return false
  if (m.detail && !finding.message.includes(m.detail)) return false
  // Small text: suppressed only while every small text on the page is one of the accepted ones. A new small text
  // anywhere on that page (a regression, or the problem spreading) brings the finding back.
  if (m.texts) { const ev = finding.evidence; if (!ev || ev.count > m.texts.length || !ev.texts.every(text => m.texts.some(known => text.startsWith(known)))) return false }
  return true
}
export function applyKnown(findings, known = []) {
  const used = new Set()
  const out = findings.map(finding => {
    const entry = known.find(row => matchesKnown(finding, row))
    if (!entry) return { ...finding, status: 'OPEN' }
    used.add(entry)
    if (finding.level === 'red') return { ...finding, status: 'OPEN', known: entry, note: '알려진 문제지만 꼭 수정 단계라 다시 표시합니다' }
    if (entry.status === 'RESOLVED') return { ...finding, status: 'OPEN', known: entry, note: '해결됨으로 표시했지만 다시 나타났습니다' }
    return { ...finding, status: entry.status, known: entry }
  })
  // Accepted issues that did not appear this run: candidates to mark RESOLVED.
  const quiet = known.filter(entry => entry.status !== 'RESOLVED' && !used.has(entry))
  return { findings: out, quiet }
}

const md = iso => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`
const PRIORITY = { DECISION: 1, REVIEW: 2, ACTION: 3 }
const SNAPSHOT_REFRESH_DAYS = 90 // lifecycle policy default (src/lib/brand-watch/lifecycle/policy.ts snapshotFreshnessDays)

// Every item a person may need to see, with its status: red findings of any scope, and yellow findings on real
// content. Items are keyed stably (keyOf), so the same problem is the same item from run to run.
export function reviewItems(findings, { now = new Date().toISOString() } = {}) {
  const eligible = findings.filter(f => f.level === 'red' || (f.level === 'yellow' && f.scope === 'REAL'))
  const keys = [...new Set(eligible.map(keyOf))], items = []
  for (const key of keys) {
    const group = eligible.filter(f => keyOf(f) === key), first = group[0], red = group.some(f => f.level === 'red')
    const status = red || group.some(f => f.status === 'OPEN') ? 'OPEN' : group.some(f => f.status === 'DEFERRED') ? 'DEFERRED' : 'ACKNOWLEDGED'
    const shown = status === 'OPEN' ? group.filter(f => f.level === 'red' || f.status === 'OPEN') : group
    const base = { key, kind: kindOf(first), level: red ? 'red' : 'yellow', status, ids: [first.id], places: [...new Set(shown.map(f => f.place ?? f.target))],
      notes: [...new Set(group.map(f => f.note).filter(Boolean))], known: [...new Set(group.filter(f => f.known).map(f => `${f.known.title}: ${f.known.reason}`))],
      detail: group.map(f => ({ rule: f.id, where: f.target, message: f.message })) }
    if (first.id === 'CONTENT-DATE-001') {
      const [brand, title] = [first.place ?? first.target.split(' · ')[0], first.target.split(' · ')[1]], ev = first.evidence
      items.push({ ...base, title: `${brand} 「${title}」 날짜 기준 정하기`,
        lines: [`현재 화면 날짜: ${md(ev.shown)} (보도일)`, `본문·포스터에 적힌 다른 날짜: ${ev.mentioned.map(day => `${day.replace('.', '월 ')}일`).join(', ')}`],
        why: '지금 날짜가 보도일인지 행사일인지 독자가 구분하기 어렵습니다.', options: ['보도일 유지', '행사 날짜 사용', '나중에 결정'],
        recommendation: null, noRecommendation: '정해진 날짜 표시 기준이 아직 없어 추천하지 않습니다.' })
    } else if (first.id === 'CONTENT-SNAPSHOT-001') {
      const ev = first.evidence, days = Math.floor((Date.parse(now) - Date.parse(`${ev.asOf}T00:00:00+09:00`)) / 86400000), brand = first.place ?? first.target
      // A recommendation only from an existing rule: the lifecycle policy's Snapshot refresh window.
      const within = days < SNAPSHOT_REFRESH_DAYS
      items.push({ ...base, title: `${brand} Snapshot을 갱신할까요?`,
        lines: [`Snapshot 기준일: ${md(ev.asOf)} (${days}일 전)`, ...ev.newer.map(m => `이후 새 움직임: ${md(m.date)} ${m.title}`)],
        why: 'Snapshot 요약에 이후의 움직임이 반영되어 있지 않습니다.', options: ['지금 갱신', '다음 정기 갱신', '나중에 결정'],
        recommendation: within ? { choice: '다음 정기 갱신', why: `Snapshot이 정해진 갱신 주기(${SNAPSHOT_REFRESH_DAYS}일) 안에 있습니다. 새 움직임이 브랜드 방향을 바꾼다고 보면 '지금 갱신'을 고르세요.` }
          : { choice: '지금 갱신', why: `Snapshot이 정해진 갱신 주기(${SNAPSHOT_REFRESH_DAYS}일)를 지났습니다.` } })
    } else {
      const kind = base.kind
      items.push({ ...base, title: first.label ?? first.message, lines: shown.slice(0, 5).map(f => `${f.target}${f.label ? `: ${f.message}` : ''}`).concat(shown.length > 5 ? [`외 ${shown.length - 5}곳`] : []),
        why: first.why ?? null, options: kind === 'REVIEW' ? ['괜찮음', '수정 필요'] : [], recommendation: null })
    }
  }
  return items.sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1) || PRIORITY[a.kind] - PRIORITY[b.kind] || a.key.localeCompare(b.key))
}

// Queue: the OPEN items, red first, then decisions, reviews and actions; at most 5; stable order.
export function buildQueue(findings, { max = 5, now } = {}) {
  return reviewItems(findings, { now }).filter(item => item.status === 'OPEN').slice(0, max)
}
