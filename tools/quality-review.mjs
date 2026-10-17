// MarkLens Quality Review V1.1 — one local entry point for Content, Design and Functional checks. It reports; a person
// decides. Every check runs even when an earlier one fails, and a check that cannot run says why.
//
//   node tools/quality-review.mjs [--full] [--base http://localhost:3000] [--out .quality-review]
//        [--brand-route /brands/{slug}] [--brands-index /brands] [--known <file>] [--insights-scope sample|real]
//
// quick (default): Content QA, all tests, page status + Design audit (when --base is given), cache settings of the last build.
// --full adds TypeScript, ESLint and a production build (only against a local database), then re-reads the cache settings.
// Output: <out>/report.md (for people), <out>/report.json (for tools), <out>/design/ (screenshots). Docs: docs/quality-review/.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { brandWatchFindings, collectBrandWatch, fetchLocalInsights, insightFindings, loadSource, openLaunchDatabase } from './quality-review/content.mjs'
import { applyKnown, buildQueue, keyOf, kindOf, scopeOf } from './quality-review/queue.mjs'

const args = process.argv.slice(2)
const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback }
const full = args.includes('--full'), out = path.resolve(opt('--out', '.quality-review')), base = opt('--base', null)
const brandRoute = opt('--brand-route', '/brands/{slug}'), brandsIndex = opt('--brands-index', '/brands')
const knownFile = path.resolve(opt('--known', 'docs/quality-review/known-issues.json'))
const insightsScope = opt('--insights-scope', 'sample') === 'real' ? 'REAL' : 'LOCAL_SAMPLE'
const LABELS = {
  'FUNC-IMAGE-001': '/_next/image 이미지 변환 사용 (Vercel 비용)', 'FUNC-IMAGE-002': '이미지 프록시 중복', 'FUNC-IMAGE-003': '깨진 이미지', 'FUNC-IMAGE-004': '주소 없는 이미지',
  'FUNC-PAGE-001': '콘솔 오류', 'FUNC-LAYOUT-001': '가로 넘침', 'DESIGN-TEXT-001': '작은 글자를 최소 기준(11px) 이상으로 올려야 합니다', 'DESIGN-TEXT-002': '한글이 고정폭 글꼴로 보입니다',
  'DESIGN-IMAGE-001': '같은 사진이 한 페이지에 크게 두 번 나옵니다', 'DESIGN-IMAGE-002': '사진 크롭이 글자·얼굴·제품·로고를 자르는지 봐 주세요', 'DESIGN-DATE-001': '한 화면에 서로 다른 날짜가 있습니다',
  'DESIGN-A11Y-001': '대체 텍스트 없는 이미지', 'DESIGN-SPACE-001': '큰 빈 공간이 있습니다', 'DESIGN-LENGTH-001': '페이지가 깁니다', 'DESIGN-HERO-001': '첫 화면에 정보가 많습니다', 'DESIGN-STYLE-001': '둥근 카드·유리·그라데이션이 있습니다',
}
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/
mkdirSync(out, { recursive: true })

const startedAt = new Date(), sections = [], findings = [], passes = []
async function section(area, name, fn) {
  const t = Date.now()
  try { const result = await fn(); sections.push({ area, name, ms: Date.now() - t, ...result }) }
  catch (error) { sections.push({ area, name, ms: Date.now() - t, status: 'ERROR', detail: error.message.split('\n')[0] }) }
  console.log(`${sections.at(-1).status.padEnd(7)} ${area} · ${name}${sections.at(-1).detail ? ` — ${sections.at(-1).detail}` : ''}`)
}
const run = (cmd, cmdArgs, env = {}) => new Promise(done => {
  const child = spawn(cmd, cmdArgs, { shell: true, env: { ...process.env, ...env } }); let text = ''
  child.stdout.on('data', d => { text += d }); child.stderr.on('data', d => { text += d })
  child.on('close', code => done({ code, text })); child.on('error', error => done({ code: -1, text: error.message }))
})
const add = (id, area, level, target, message, extra = {}) => findings.push({ id, area, level, target, message, review: 'auto', ...extra })

// ---------- Content ----------
let brandNames = {}
await section('content', 'Brand Watch (출시 데이터 5개 브랜드)', async () => {
  const handle = await openLaunchDatabase()
  try {
    const data = await collectBrandWatch(handle)
    brandNames = Object.fromEntries(data.states.map(s => [s.brand.slug, s.brand.displayName]))
    const list = brandWatchFindings(data); findings.push(...list)
    const pub = data.states.filter(s => s.kind === 'available').map(s => s.brand.displayName), priv = data.states.filter(s => s.kind !== 'available').map(s => s.brand.displayName)
    if (!list.some(f => f.level === 'red')) passes.push(`Brand Watch 근거 연결: 끊긴 연결·공개 데이터 유출 없음 (공개 ${pub.join(', ')} / 비공개 ${priv.join(', ')})`)
    return { status: list.some(f => f.level === 'red') ? 'FAIL' : list.some(f => f.level === 'yellow') ? 'REVIEW' : 'PASS', detail: `공개 ${pub.length} · 비공개 ${priv.length}` }
  } finally { await handle.close() }
})
await section('content', 'Insights (로컬 데이터)', async () => {
  const source = await fetchLocalInsights(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (source.skipped) return { status: 'SKIPPED', detail: source.skipped }
  const { isHotlinkBlocked } = loadSource('src/lib/images.ts')
  const { findings: list, publicCount } = insightFindings(source.rows, { isHotlinkBlocked }); findings.push(...list)
  if (!list.length) passes.push(`Insights ${publicCount}개: 주소·제목·카테고리·요약·출처·이미지 이상 없음`)
  return { status: list.some(f => f.level === 'red') ? 'FAIL' : list.length ? 'REVIEW' : 'PASS', detail: `공개 ${publicCount}개` }
})

// ---------- Functional: tests ----------
const GROUPS = [
  ['Brand Watch 데이터·분석 흐름', /^brand-watch(-intelligence|-sources|-patterns|-takes|-snapshots|-lifecycle|-launch)?\.test\.mjs$/],
  ['Brand Watch 관리자·검수 명령', /^brand-watch-(admin|review|analysis-review)\.test\.mjs$/],
  ['공개 페이지·데이터 보호', /^brand-watch-public\.test\.mjs$/],
  ['캐시·갱신', /^(public-cache|revalidate-scope|insight-timestamp)\.test\.mjs$/],
  ['이미지 전송', /^public-images\.test\.mjs$/],
  ['Quality Review 검증', /^quality-review\.test\.mjs$/],
  ['뉴스레터·구독·기타', /\.test\.mjs$/],
]
const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs')), assigned = new Set()
for (const [name, pattern] of GROUPS) {
  const group = files.filter(file => !assigned.has(file) && pattern.test(file)); group.forEach(file => assigned.add(file))
  if (!group.length) continue
  await section('functional', `테스트 · ${name}`, async () => {
    const { code, text } = await run('node', ['--test', ...group.map(file => `tests/${file}`)])
    const pass = Number(text.match(/^# pass (\d+)/m)?.[1] ?? 0), fail = Number(text.match(/^# fail (\d+)/m)?.[1] ?? 0)
    const failed = [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1])
    if (code !== 0 || fail) { add('FUNC-TEST-001', 'functional', 'red', `테스트 · ${name}`, `${fail || '?'}개 실패${failed.length ? `: ${failed.slice(0, 3).join(' / ')}` : ''}${pass + fail === 0 ? ` (실행 오류: ${text.trim().split('\n').at(-1)})` : ''}`); return { status: 'FAIL', detail: `${pass} 통과 · ${fail} 실패` } }
    passes.push(`테스트 · ${name}: ${pass}개 통과`); return { status: 'PASS', detail: `${pass} 통과` }
  })
}

// ---------- Functional + Design: pages (local only) ----------
let routes = []
if (!base) sections.push({ area: 'functional', name: '페이지 응답 · 화면 검수', status: 'SKIPPED', detail: '--base 로컬 주소가 없어 실행하지 않았습니다' })
else if (!LOCAL.test(base)) sections.push({ area: 'functional', name: '페이지 응답 · 화면 검수', status: 'SKIPPED', detail: `로컬 주소만 검사합니다 (${base})` })
else {
  await section('functional', '페이지 응답', async () => {
    const { PUBLIC_BRAND_SLUGS } = loadSource('src/lib/brand-watch/public/view.ts')
    // A detail page to check: a link on the list, else a slug in the list's page data, else one from the last build.
    const list = await (await fetch(new URL('/insights', base))).text()
    const built = existsSync('.next/prerender-manifest.json') ? Object.keys(JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8')).routes).find(route => /^\/insights\/[^/]+$/.test(route))?.slice(10) : null
    const detail = list.match(/href="\/insights\/([^"?#/]+)"/)?.[1] ?? list.match(/\\"slug\\":\\"([^\\"]+)\\"/)?.[1] ?? built
    routes = [['home', '홈', '/'], ['insights', '인사이트 목록', '/insights'], ...(detail ? [['insight', '인사이트 상세', `/insights/${detail}`]] : []), ['brands', '브랜드 목록', brandsIndex],
      ...PUBLIC_BRAND_SLUGS.map(slug => [slug, brandNames[slug] ?? slug, brandRoute.replace('{slug}', slug)])]
    const bad = []
    for (const [, label, route] of routes) { const res = await fetch(new URL(route, base), { redirect: 'manual' }); if (res.status !== 200) bad.push(`${label} ${route} → ${res.status}`) }
    for (const line of bad) add('FUNC-ROUTE-001', 'functional', 'red', line.split(' ')[0], line)
    if (!bad.length) passes.push(`페이지 ${routes.length}개 모두 정상 응답 (200)`)
    if (!detail) sections.push({ area: 'functional', name: '인사이트 상세 페이지', status: 'SKIPPED', detail: '검사할 상세 주소를 찾지 못했습니다' })
    return { status: bad.length ? 'FAIL' : 'PASS', detail: `${routes.length}개 페이지` }
  })
  await section('design', '화면 자동 검수 (1440 · 390)', async () => {
    const dir = path.join(out, 'design')
    const { code, text } = await run('node', ['tools/design-audit.mjs', '--out', `"${dir}"`, ...routes.map(([name, , route]) => `"${name}=${new URL(route, base)}"`)])
    if (!existsSync(path.join(dir, 'report.json'))) throw new Error(`design audit did not finish (exit ${code}): ${text.trim().split('\n').at(-1)}`)
    const pages = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')), label = Object.fromEntries(routes.map(([name, l]) => [name, l]))
    for (const page of pages) for (const check of page.checks) {
      const extra = { page: page.name, label: LABELS[check.id] }
      // Small text keeps its texts, so a known issue (e.g. the footer) can be matched exactly and a new one is not hidden.
      if (check.id === 'DESIGN-TEXT-001') {
        const samples = [...page.fonts.metadata.samples, ...page.fonts.primary.samples].sort((a, b) => a.size - b.size), count = page.fonts.metadata.under11 + page.fonts.primary.under11
        Object.assign(extra, { evidence: { count, texts: samples.map(s => s.text) }, why: 'Design Bible의 최소 글자 크기는 11px입니다.' })
        check.detail = `${count}개, 가장 작은 것 ${samples[0].size}px "${samples[0].text}"`
      }
      add(check.id, check.id.startsWith('FUNC') ? 'functional' : 'design', check.level === 'FAIL' ? 'red' : 'yellow', `${label[page.name] ?? page.name} @${page.width}`, check.detail, extra)
    }
    const fired = new Set(pages.flatMap(page => page.checks.map(check => check.id)))
    for (const [id, text] of [['FUNC-IMAGE-003', '깨진 이미지 0'], ['FUNC-IMAGE-001', '/_next/image 0'], ['FUNC-IMAGE-002', '이미지 프록시 중복 0'], ['FUNC-PAGE-001', '콘솔 오류 0'],
      ['FUNC-LAYOUT-001', '가로 넘침 0'], ['DESIGN-TEXT-002', '고정폭 글꼴로 보이는 한글 0'], ['DESIGN-IMAGE-001', '크게 반복되는 사진 0'], ['DESIGN-STYLE-001', '둥근 카드·유리·그라데이션 0']])
      if (!fired.has(id)) passes.push(`${text} (${pages.length}개 화면)`)
    return { status: pages.some(page => page.result === 'FAIL') ? 'FAIL' : pages.some(page => page.result === 'REVIEW') ? 'REVIEW' : 'PASS', detail: `${pages.length}개 화면 · 스크린샷 ${path.relative('.', dir)}` }
  })
}

// ---------- Functional: full mode ----------
const firstLines = text => text.trim().split('\n').filter(Boolean).slice(0, 3).join(' / ').slice(0, 300)
if (full) {
  await section('functional', 'TypeScript', async () => {
    const { code, text } = await run('npx', ['tsc', '--noEmit'])
    if (code) { add('FUNC-TYPE-001', 'functional', 'red', 'TypeScript', firstLines(text)); return { status: 'FAIL' } }
    passes.push('TypeScript 오류 0'); return { status: 'PASS' }
  })
  await section('functional', 'ESLint', async () => {
    const { code, text } = await run('npx', ['eslint', '.'])
    const errors = Number(text.match(/\((\d+) errors?/)?.[1] ?? (code ? 1 : 0)), warnings = Number(text.match(/(\d+) warnings?\)/)?.[1] ?? 0)
    if (errors) { add('FUNC-LINT-001', 'functional', 'red', 'ESLint', `오류 ${errors}개`); return { status: 'FAIL', detail: `오류 ${errors} · 경고 ${warnings}` } }
    passes.push(`ESLint 오류 0${warnings ? ` (경고 ${warnings}개)` : ''}`); return { status: 'PASS', detail: `경고 ${warnings}` }
  })
  await section('functional', '프로덕션 빌드', async () => {
    const db = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!db || !LOCAL.test(db)) return { status: 'SKIPPED', detail: '빌드는 로컬 DB 주소(NEXT_PUBLIC_SUPABASE_URL)로만 실행합니다' }
    const { code, text } = await run('npx', ['next', 'build'])
    if (code) { add('FUNC-BUILD-001', 'functional', 'red', '빌드', firstLines(text.split('\n').filter(line => /rror|Failed/.test(line)).join('\n') || text)); return { status: 'FAIL' } }
    passes.push('프로덕션 빌드 성공'); return { status: 'PASS', detail: '실행 중인 로컬 서버는 다시 시작해야 새 빌드를 보여 줍니다' }
  })
}
await section('functional', '캐시 설정', async () => {
  const file = '.next/prerender-manifest.json'
  if (!existsSync(file)) return { status: 'SKIPPED', detail: '빌드 결과가 없습니다' }
  const { routes: built } = JSON.parse(readFileSync(file, 'utf8')), { PUBLIC_BRAND_SLUGS } = loadSource('src/lib/brand-watch/public/view.ts')
  const expected = [['/', 21600], ['/insights', 21600], ['/brands', 21600], ...PUBLIC_BRAND_SLUGS.map(slug => [`/brands/${slug}`, 21600]),
    ...Object.keys(built).filter(route => /^\/insights\/[^/]+$/.test(route)).map(route => [route, 86400])]
  const wrong = expected.filter(([route, seconds]) => built[route]?.initialRevalidateSeconds !== seconds)
  for (const [route, seconds] of wrong) add('FUNC-CACHE-001', 'functional', 'red', route, `갱신 주기가 ${built[route]?.initialRevalidateSeconds ?? '없음'}초입니다 (기대 ${seconds}초)`)
  if (!wrong.length) passes.push(`캐시: 홈·목록·브랜드 6시간, 인사이트 상세 24시간 (${full ? '이번 빌드' : '마지막 빌드'} 기준)`)
  return { status: wrong.length ? 'FAIL' : 'PASS', detail: `${expected.length}개 경로` }
})

// ---------- Human queue ----------
// Scope: Brand Watch content is the real launch dataset; Insights pages show whatever the local database holds
// (sample data unless --insights-scope real). Known issues stop accepted findings from being asked again.
const INSIGHT_PAGES = new Set(['home', 'insights', 'insight'])
for (const f of findings) {
  const dataScope = f.target.startsWith('file:') ? 'TEST_FIXTURE' : (INSIGHT_PAGES.has(f.page) || f.id.startsWith('INSIGHT-')) ? insightsScope : 'REAL'
  Object.assign(f, { key: keyOf(f), kind: kindOf(f), scope: scopeOf(f, dataScope) })
}
const known = existsSync(knownFile) ? JSON.parse(readFileSync(knownFile, 'utf8')).issues : []
const { findings: judged, quiet } = applyKnown(findings, known)
const queue = buildQueue(judged)
// Vision review is reported as a status, never asked: required when design files changed in the last commit or the working tree.
const changed = [(await run('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'])).text, (await run('git', ['status', '--porcelain'])).text].join('\n')
const designFiles = [...new Set(changed.split('\n').map(line => line.replace(/^.. /, '').trim()).filter(file => /^(src\/(components|app)\/.*\.(tsx|css)|public\/)/.test(file)))]
const visionReview = { required: designFiles.length > 0, status: 'NOT_RUN', files: designFiles }

// ---------- Report ----------
const group = list => { const out = []; for (const f of list) { const row = f.label && out.find(g => g.id === f.id && g.level === f.level && g.label); if (row) row.targets.push(f.target); else out.push({ ...f, targets: [f.target] }) } return out }
const reds = group(judged.filter(f => f.level === 'red')), open = group(judged.filter(f => f.level === 'yellow' && f.status === 'OPEN' && f.scope === 'REAL'))
const sample = group(judged.filter(f => f.level === 'yellow' && f.status === 'OPEN' && f.scope !== 'REAL')), accepted = group(judged.filter(f => f.level === 'yellow' && f.status !== 'OPEN'))
const notes = judged.filter(f => f.level === 'info'), errors = sections.filter(s => s.status === 'ERROR' || s.status === 'SKIPPED')
const where = g => g.targets.length > 3 ? `${g.targets.slice(0, 3).join(', ')} 외 ${g.targets.length - 3}곳` : g.targets.join(', ')
const item = (q, i) => [`${i + 1}. ${q.level === 'red' ? '🔴' : '🟡'} **${q.title}**`, ...q.lines.map(text => `   - ${text}`), ...(q.why ? [`   - 왜: ${q.why}`] : []), ...(q.options.length ? [`   - 선택: ${q.options.map(o => `[${o}]`).join(' ')}`] : [])]
const STATUS = { ACKNOWLEDGED: '확인됨', DEFERRED: '보류' }

const md = [
  `# 검수 결과 (${startedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${full ? '전체' : '빠른'} 검수)`, '',
  `🔴 꼭 수정 ${reds.length} · 🟡 확인 필요 ${open.length} · 🟢 괜찮음 ${passes.length}`,
  `(이미 알고 있는 문제 ${accepted.length}개, 샘플 데이터에서만 나온 것 ${sample.length}개는 질문하지 않았습니다)`, '',
  reds.length ? '**지금 고쳐야 할 문제가 있습니다.**' : '**고쳐야 할 큰 문제는 없습니다.**', '',
  '## 내가 확인할 것', ...(queue.length ? queue.flatMap(item) : ['- 없음']), '',
  '## 자동으로 판단하지 않은 것',
  visionReview.required ? `- 화면 검수(사람 판단): **미실행.** 최근 디자인 파일이 바뀌어 필요합니다 (${designFiles.length}개). 스크린샷: \`${path.relative('.', path.join(out, 'design'))}\`, 기준: [vision-review.md](../docs/design-intelligence/vision-review.md)`
    : '- 화면 검수(사람 판단): 최근 디자인 변경이 없어 필요하지 않습니다.',
  '- 날짜·출처·해석이 실제로 맞는지: 원문 대조가 필요합니다.', '',
  ...(errors.length ? ['## 실행하지 못한 검사', ...errors.map(s => `- ${s.name}: ${s.detail ?? s.status}`), ''] : []),
  '## 괜찮은 것', ...passes.map(p => `- 🟢 ${p}`), ...notes.map(f => `- 참고: ${f.target} — ${f.message}`), '',
  ...(sample.length ? ['## 실제 데이터에서 재확인 필요', '로컬 샘플 데이터로 본 화면이라, 실제 콘텐츠에서 다시 봐야 합니다.', ...sample.map(g => `- 🟡 ${g.label ?? g.message} — ${where(g)}`), ''] : []),
  ...(accepted.length ? ['## 이미 알고 있는 문제', ...accepted.map(g => `- ${STATUS[g.status]}: ${g.known.title} — ${g.known.reason} (${where(g)})`), ''] : []),
  ...(quiet.length ? ['## 이번에 나타나지 않은 알려진 문제', '고쳐졌다면 known-issues.json에서 RESOLVED로 바꾸세요.', ...quiet.map(entry => `- ${entry.title}`), ''] : []),
  '## 다음에 할 일', reds.length ? '- 🔴 항목을 고친 뒤 다시 검수하세요.' : queue.length ? '- 위 항목을 정하거나 고친 뒤 다시 검수하세요.' : '- 승인하면 됩니다.', '',
  '---', '## 상세', '', '| 영역 | 상태 | 범위 | 처리 | 규칙 | 대상 | 내용 |', '|---|---|---|---|---|---|---|',
  ...group(judged).map(g => `| ${{ content: '콘텐츠', design: '디자인', functional: '기능' }[g.area]} | ${{ red: '🔴', yellow: '🟡', info: '🟢' }[g.level]} | ${g.scope} | ${g.status} | ${g.id} | ${where(g).replace(/\|/g, '/')} | ${(g.label ? `${g.label}. 예: ${g.message}` : g.message).replace(/\|/g, '/')} |`), '',
  '## 실행한 검사', '', '| 영역 | 검사 | 결과 | 비고 | 시간 |', '|---|---|---|---|---|',
  ...sections.map(s => `| ${s.area} | ${s.name} | ${s.status} | ${(s.detail ?? '').replace(/\|/g, '/')} | ${(s.ms / 1000).toFixed(1)}s |`), '',
]
writeFileSync(path.join(out, 'report.md'), md.join('\n'))
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ runAt: startedAt.toISOString(), mode: full ? 'full' : 'quick', base, knownFile: path.relative('.', knownFile),
  summary: { red: reds.length, yellow: open.length, green: passes.length, accepted: accepted.length, sampleOnly: sample.length }, visionReview, sections,
  findings: judged.map(({ known: entry, ...f }) => ({ ...f, ...(entry ? { knownTitle: entry.title, knownReason: entry.reason } : {}) })), humanQueue: queue }, null, 1))
console.log(`\n🔴 ${reds.length} · 🟡 ${open.length} · 🟢 ${passes.length} · 질문 ${queue.length}  →  ${path.relative('.', path.join(out, 'report.md'))}`)
process.exitCode = reds.length ? 1 : 0
