// MarkLens Quality Review V1 — one local entry point for Content, Design and Functional checks. It reports; a person
// decides. Every check runs even when an earlier one fails, and a check that cannot run says why.
//
//   node tools/quality-review.mjs [--full] [--base http://localhost:3000] [--out .quality-review]
//        [--brand-route /brands/{slug}] [--brands-index /brands]
//
// quick (default): Content QA, all tests, page status + Design audit (when --base is given), cache settings of the last build.
// --full adds TypeScript, ESLint and a production build (only against a local database), then re-reads the cache settings.
// Output: <out>/report.md (for people), <out>/report.json (for tools), <out>/design/ (screenshots). Docs: docs/quality-review/.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { brandWatchFindings, collectBrandWatch, fetchLocalInsights, insightFindings, loadSource, openLaunchDatabase } from './quality-review/content.mjs'

const args = process.argv.slice(2)
const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback }
const full = args.includes('--full'), out = path.resolve(opt('--out', '.quality-review')), base = opt('--base', null)
const brandRoute = opt('--brand-route', '/brands/{slug}'), brandsIndex = opt('--brands-index', '/brands')
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
    for (const page of pages) for (const check of page.checks) add(check.id, check.id.startsWith('FUNC') ? 'functional' : 'design', check.level === 'FAIL' ? 'red' : 'yellow', `${label[page.name] ?? page.name} @${page.width}`, check.detail)
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

// ---------- Report ----------
const LABELS = {
  'FUNC-IMAGE-001': '/_next/image 이미지 변환 사용 (Vercel 비용)', 'FUNC-IMAGE-002': '이미지 프록시 중복', 'FUNC-IMAGE-003': '깨진 이미지', 'FUNC-IMAGE-004': '주소 없는 이미지',
  'FUNC-PAGE-001': '콘솔 오류', 'FUNC-LAYOUT-001': '가로 넘침', 'DESIGN-TEXT-001': '11px보다 작은 글자', 'DESIGN-TEXT-002': '고정폭 글꼴로 보이는 한글',
  'DESIGN-IMAGE-001': '같은 사진이 크게 두 번', 'DESIGN-IMAGE-002': '사진 크롭 확인 (글자·얼굴·제품·로고가 잘리는지)', 'DESIGN-DATE-001': '한 화면에 서로 다른 날짜 (뜻은 콘텐츠 검수)',
  'DESIGN-A11Y-001': '대체 텍스트 없는 이미지', 'DESIGN-SPACE-001': '큰 빈 공간', 'DESIGN-LENGTH-001': '긴 페이지', 'DESIGN-HERO-001': '첫 화면 정보 과다', 'DESIGN-STYLE-001': '둥근 카드·유리·그라데이션',
}
// Page-level checks are grouped per rule (one line, many pages); content and functional findings stay one per item.
const grouped = []
for (const f of findings) {
  if (!LABELS[f.id]) { grouped.push({ ...f, targets: [f.target] }); continue }
  const row = grouped.find(g => g.id === f.id && g.level === f.level && g.label)
  if (row) row.targets.push(f.target); else grouped.push({ ...f, label: LABELS[f.id], message: LABELS[f.id], sample: f.message, targets: [f.target] })
}
const reds = grouped.filter(g => g.level === 'red'), yellows = grouped.filter(g => g.level === 'yellow'), notes = grouped.filter(g => g.level === 'info')
// First look: every red, then the top item of each area, so one area cannot fill the list.
const firsts = ['content', 'design', 'functional'].map(area => yellows.find(g => g.area === area)).filter(Boolean)
const rest = yellows.filter(g => !firsts.includes(g)), fresh = rest.filter(g => !firsts.some(f => f.id === g.id))
const queue = [...new Set([...reds, ...firsts, ...fresh, ...rest])].slice(0, 3)
const errors = sections.filter(s => s.status === 'ERROR' || s.status === 'SKIPPED')
const where = g => g.targets.length > 3 ? `${g.targets.slice(0, 3).join(', ')} 외 ${g.targets.length - 3}곳` : g.targets.join(', ')
const line = g => g.label ? `${g.label} — ${where(g)}` : `${g.targets[0]}: ${g.message}`

const md = [
  `# 검수 결과 (${startedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${full ? '전체' : '빠른'} 검수)`, '',
  `🔴 꼭 수정 ${reds.length} · 🟡 확인 필요 ${yellows.length} · 🟢 괜찮음 ${passes.length}`, '',
  reds.length ? '**지금 고쳐야 할 문제가 있습니다.**' : '**고쳐야 할 큰 문제는 없습니다.**', '',
  '## 가장 먼저 볼 것', ...(queue.length ? queue.map((g, i) => `${i + 1}. ${g.level === 'red' ? '🔴' : '🟡'} ${line(g)}`) : ['- 없음']), '',
  '## 내가 확인할 것', ...(yellows.some(g => g.question) ? yellows.filter(g => g.question).slice(0, 5).map((g, i) => `${i + 1}. ${g.question}\n   이유: ${g.reason}`) : ['- 없음']), '',
  '## 자동으로 판단하지 않은 것',
  '- 화면 판단(AI 대시보드 느낌, 편집 품질, 브랜드 구분, Pattern의 힘): 스크린샷으로 [vision-review.md](../docs/design-intelligence/vision-review.md)를 보세요.',
  '- 날짜·출처·해석이 실제로 맞는지: 원문 대조가 필요합니다.', '',
  ...(errors.length ? ['## 실행하지 못한 검사', ...errors.map(s => `- ${s.name}: ${s.detail ?? s.status}`), ''] : []),
  '## 괜찮은 것', ...passes.map(p => `- 🟢 ${p}`), ...notes.map(g => `- 참고: ${g.targets[0]} — ${g.message}`), '',
  '## 다음에 할 일', reds.length ? '- 🔴 항목을 고친 뒤 다시 검수하세요.' : yellows.length ? '- 🟡 항목을 보고 유지할지 고칠지 정하세요. 고친 뒤 다시 검수하세요.' : '- 승인하면 됩니다.', '',
  '---', '## 상세', '', '| 영역 | 상태 | 규칙 | 대상 | 내용 |', '|---|---|---|---|---|',
  ...grouped.map(g => `| ${{ content: '콘텐츠', design: '디자인', functional: '기능' }[g.area]} | ${{ red: '🔴', yellow: '🟡', info: '🟢' }[g.level]} | ${g.id} | ${where(g).replace(/\|/g, '/')} | ${(g.label ? `${g.label}. 예: ${g.sample}` : g.message).replace(/\|/g, '/')} |`), '',
  '## 실행한 검사', '', '| 영역 | 검사 | 결과 | 비고 | 시간 |', '|---|---|---|---|---|',
  ...sections.map(s => `| ${s.area} | ${s.name} | ${s.status} | ${(s.detail ?? '').replace(/\|/g, '/')} | ${(s.ms / 1000).toFixed(1)}s |`), '',
]
writeFileSync(path.join(out, 'report.md'), md.join('\n'))
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ runAt: startedAt.toISOString(), mode: full ? 'full' : 'quick', base, summary: { red: reds.length, yellow: yellows.length, green: passes.length },
  sections, findings, humanQueue: yellows.filter(g => g.question).map(g => ({ id: g.id, target: g.targets[0], question: g.question, reason: g.reason })) }, null, 1))
console.log(`\n🔴 ${reds.length} · 🟡 ${yellows.length} · 🟢 ${passes.length}  →  ${path.relative('.', path.join(out, 'report.md'))}`)
process.exitCode = reds.length ? 1 : 0
