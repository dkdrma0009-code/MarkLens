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
export const scopeOf = (finding, dataScope = 'REAL') => DATA_DEPENDENT.test(finding.id) ? dataScope : 'REAL'

export const keyOf = finding => `${finding.id}|${finding.target}`

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
const PRIORITY = { ACTION: 3, DECISION: 1, REVIEW: 2 }
// Queue: OPEN findings on real content, red first, then decisions, reviews and actions; at most 5; stable order.
export function buildQueue(findings, { max = 5 } = {}) {
  const open = findings.filter(f => f.status === 'OPEN' && (f.level === 'red' || (f.level === 'yellow' && f.scope === 'REAL')))
  const items = []
  // One decision per date question: each movement's date means something different, so they are not merged.
  for (const f of open.filter(f => f.id === 'CONTENT-DATE-001')) items.push({ key: keyOf(f), kind: 'DECISION', level: f.level, ids: [f.id],
    title: `${f.target.split(' · ')[0]} 「${f.target.split(' · ')[1]}」의 날짜 기준을 정해야 합니다`,
    lines: [`화면 날짜: ${md(f.evidence.shown)} (보도일)`, `본문·포스터에 적힌 날짜: ${f.evidence.mentioned.map(day => `${day.replace('.', '월 ')}일`).join(', ')}`],
    why: '지금 화면의 날짜가 행사일인지 보도일인지 독자가 알기 어렵습니다.', options: ['보도일 유지', '본문의 행사 날짜 사용', '나중에 결정'] })
  for (const f of open.filter(f => f.id === 'CONTENT-SNAPSHOT-001')) items.push({ key: keyOf(f), kind: 'DECISION', level: f.level, ids: [f.id],
    title: `${f.target} Snapshot을 갱신할지 정해야 합니다`,
    lines: [`Snapshot 기준일: ${md(f.evidence.asOf)}`, ...f.evidence.newer.map(m => `이후 움직임: ${md(m.date)} ${m.title}`)],
    why: 'Snapshot 요약에 이후의 움직임이 반영되어 있지 않습니다.', options: ['지금 갱신', '다음 정기 갱신 때', '나중에 결정'] })
  // Everything else is grouped per rule (one item, many places).
  const rest = open.filter(f => !['CONTENT-DATE-001', 'CONTENT-SNAPSHOT-001'].includes(f.id))
  for (const id of [...new Set(rest.map(f => f.id))]) {
    const group = rest.filter(f => f.id === id), first = group[0], kind = kindOf(first)
    items.push({ key: `${id}|${group.map(f => f.target).sort().join(',')}`, kind, level: group.some(f => f.level === 'red') ? 'red' : 'yellow', ids: [id],
      title: first.label ?? first.message, lines: group.slice(0, 4).map(f => `${f.target}${f.label ? `: ${f.message}` : ''}`).concat(group.length > 4 ? [`외 ${group.length - 4}곳`] : []),
      why: first.why ?? null, options: kind === 'REVIEW' ? ['괜찮음 (확인됨으로 표시)', '수정 필요'] : [] })
  }
  return items.sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1) || PRIORITY[a.kind] - PRIORITY[b.kind] || a.key.localeCompare(b.key)).slice(0, max)
}
