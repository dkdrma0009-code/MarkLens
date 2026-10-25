import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as releaseGuard from '../src/lib/release/guard.mjs'

// Regressions found by the Site-Wide Audit V1: a subscribe form that claimed success on failure, and the Career Lab
// menu that lost its active state on its own sub-pages. Chapter B IA V1: the approved menu, footer and Career names,
// checked on the rendered components. No network, no email: the API runs with stand-ins.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports
}
const { subscriptionOutcome } = load('src/lib/newsletter/subscription-result.ts')

// The real POST /api/subscribe with its database, rate limit and mail sender replaced.
function subscribeApi({ rpc = { data: [{ result: 'issued', subscription_created: true }], error: null }, mailFails = false, limited = false } = {}) {
  const sent = []
  const route = load('src/app/api/subscribe/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
    '@/lib/release/guard.mjs': releaseGuard,
    '@/lib/rate-limit': { checkRateLimit: () => limited ? { status: 429, body: { error: '요청이 너무 많습니다' } } : null },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => rpc }) },
    '@/lib/newsletter/confirmation-mail.mjs': { confirmationUrl: () => 'https://example.test/confirm', sendConfirmEmail: async to => { if (mailFails) throw new Error('send failed'); sent.push(to) } },
  })
  return { sent, post: email => route.POST({ json: async () => ({ email, source: 'insight_feedback' }) }) }
}
const SENT = /보냈어요/

test('subscribe: the reader is told an email was sent only when the API sent it', async () => {
  const cases = [
    ['new subscriber', subscribeApi(), 'new', true],
    ['pending again (mail re-sent)', subscribeApi({ rpc: { data: [{ result: 'issued', subscription_created: false }], error: null } }), 'existing', true],
    ['already subscribed', subscribeApi({ rpc: { data: [{ result: 'already_active' }], error: null } }), 'already', true],
    ['mail sender failed', subscribeApi({ mailFails: true }), 'emailFailed', false],
    ['database failed (500)', subscribeApi({ rpc: { data: null, error: { message: 'down' } } }), 'failure', false],
    ['rate limited (429)', subscribeApi({ limited: true }), 'rateLimited', false],
  ]
  for (const [name, api, result, done] of cases) {
    const res = await api.post('reader@example.test'), outcome = subscriptionOutcome(res.status, res.body)
    assert.equal(outcome.result, result, name); assert.equal(outcome.done, done, name)
    // "sent" wording appears exactly when a confirmation mail actually went out.
    assert.equal(SENT.test(outcome.message), api.sent.length > 0 && result !== 'already', `${name}: ${outcome.message}`)
  }
  const invalid = subscribeApi(), res = await invalid.post('not-an-email')
  assert.equal(res.status, 400); assert.equal(subscriptionOutcome(res.status, res.body).result, 'invalid'); assert.equal(invalid.sent.length, 0)
  // No response, or a body that is not the API's: a failure, never a success.
  for (const [status, body] of [[0, null], [200, null], [200, { success: false }], [502, { success: true }]]) {
    const outcome = subscriptionOutcome(status, body); assert.equal(outcome.result, 'failure'); assert.equal(outcome.done, false); assert.doesNotMatch(outcome.message, SENT)
  }
})

test('subscribe: every form that posts to /api/subscribe reads the shared result and sends its source', () => {
  const files = [], walk = dir => { for (const name of readdirSync(dir)) { const file = path.join(dir, name); if (statSync(file).isDirectory()) walk(file); else if (/\.tsx?$/.test(name)) files.push(file) } }
  walk('src')
  const forms = files.filter(file => /fetch\(\s*["'`]\/api\/subscribe["'`]/.test(readFileSync(file, 'utf8')))
  // C-1: the Insight detail keeps one form (the Weekly CTA); the feedback block no longer has its own.
  assert.ok(forms.length >= 2, `found ${forms.length} subscribe forms`)
  for (const file of forms) {
    const code = readFileSync(file, 'utf8')
    assert.match(code, /subscription(Result|Outcome)\(/, `${file} must judge the response with lib/newsletter/subscription-result`)
    assert.match(code, /JSON\.stringify\(\{\s*email,\s*source:/, `${file} must send its source`)
  }
})

// Rendering: the real components to static HTML, with Next's Link, router and icons replaced by plain stand-ins.
const { createElement } = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const Link = ({ href, children, ...rest }) => createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([, value]) => typeof value !== 'function')) }, children)
const esm = value => ({ __esModule: true, default: value })
const ui = { 'next/link': esm(Link), 'lucide-react': new Proxy({}, { get: () => () => null }), '@/lib/brand/WordmarkSvg': esm(() => null) }
const navigation = load('src/components/layout/navigation.ts')
const links = html => [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map(([, attrs, text]) => ({ href: attrs.match(/href="([^"]*)"/)?.[1], current: attrs.match(/aria-current="([^"]*)"/)?.[1], text: text.replace(/<[^>]+>/g, '') }))
function renderMenu(pathname) {
  const { default: PublicNavigation } = load('src/components/layout/PublicNavigation.tsx', { ...ui, 'next/navigation': { usePathname: () => pathname }, './navigation': navigation })
  return links(renderToStaticMarkup(createElement(PublicNavigation, { className: 'ml-desktop-nav' })))
}
const MENU = [['Insights', '/insights'], ['Brand Watch', '/brands'], ['Career Lab', '/practice'], ['Dictionary', '/glossary'], ['Weekly', '/newsletter']]

test('navigation: the menu renders the approved five items in order, without Trends or Collections', () => {
  const menu = renderMenu('/')
  assert.deepEqual(menu.map(link => [link.text, link.href]), MENU)
  assert.ok(!menu.some(link => /Trends|Collections|#/.test(link.text + link.href)))
  assert.deepEqual(menu.filter(link => link.current), []) // nothing is current on Home; Home is the wordmark
})

test('navigation: Career Lab stays active on its sub-pages and no other item lights up', () => {
  const active = pathname => renderMenu(pathname).filter(link => link.current).map(link => `${link.text}=${link.current}`)
  assert.deepEqual(active('/practice'), ['Career Lab=page'])
  for (const pathname of ['/learn', '/interview', '/interview/prep', '/insight-lab']) assert.deepEqual(active(pathname), ['Career Lab=true'], pathname)
  const expected = [['/insights', 'Insights=page'], ['/insights/some-story', 'Insights=true'], ['/brands', 'Brand Watch=page'], ['/brands/musinsa', 'Brand Watch=true'],
    ['/glossary', 'Dictionary=page'], ['/newsletter', 'Weekly=page']]
  for (const [pathname, current] of expected) assert.deepEqual(active(pathname), [current], pathname)
  for (const pathname of ['/', '/about', '/feedback', '/login', '/interviews', '/learning', '/practiced', '/insight-labs']) assert.deepEqual(active(pathname), [], pathname)
})

test('footer: no removed menu links, Career tools under their official names, Dictionary and Weekly kept', () => {
  // R-4: the privacy link appears only once src/lib/legal/privacy.ts is complete — today the footer is unchanged.
  const { default: Footer } = load('src/components/layout/Footer.tsx', { ...ui, './navigation': navigation, '@/lib/legal/privacy': load('src/lib/legal/privacy.ts') })
  const footer = links(renderToStaticMarkup(createElement(Footer))).filter(link => link.href?.startsWith('/'))
  assert.deepEqual(footer.map(link => [link.text, link.href]), [['', '/#main-content'], ['Insights', '/insights'], ['Dictionary', '/glossary'],
    ['Career Lab', '/practice'], ['Insight Lab', '/insight-lab'], ['AI Interview', '/interview'], ['Trend Quiz', '/learn'],
    ['MarkLens 소개', '/about'], ['Weekly', '/newsletter'], ['피드백', '/feedback'], ['RSS', '/feed.xml']])
  assert.ok(!footer.some(link => /Trends|Collections|Learn$|#signals|#collections/.test(link.text + link.href)))
})

test('home: Signals and Collections keep their sections, anchors and category links', () => {
  const data = load('src/components/home/data.ts', { '@/lib/images': { isHotlinkBlocked: () => false } })
  const home = { ...ui, './data': data, './EditorialImage': esm(() => null) }
  const { default: Signals } = load('src/components/home/Signals.tsx', home)
  assert.match(renderToStaticMarkup(createElement(Signals, { insights: [], since: '2026-10-11T00:00:00Z', until: '2026-10-18T00:00:00Z' })), /<section id="signals"/)
  const { default: CollectionShowcase } = load('src/components/home/CollectionShowcase.tsx', home)
  const { default: Collections } = load('src/components/home/Collections.tsx', { ...home, './CollectionShowcase': esm(CollectionShowcase) })
  const cover = category => ({ id: category, category, created_at: '2026-10-10T00:00:00Z', article: { source_name: 'MarkLens' } })
  const html = renderToStaticMarkup(createElement(Collections, { collections: ['브랜딩', 'CRM'].map(category => ({ category, cover: cover(category) })) }))
  assert.match(html, /<section id="collections"/)
  assert.deepEqual([...new Set(links(html).map(link => link.href))], ['/insights?category=%EB%B8%8C%EB%9E%9C%EB%94%A9', '/insights?category=CRM'])
})

test('home hero (C-2): approved copy and CTAs, one high-priority cover with a phone source, every story kept, nothing invented', () => {
  const data = load('src/components/home/data.ts', { '@/lib/images': { isHotlinkBlocked: () => false } })
  const { default: HeroCover } = load('src/components/home/HeroCover.tsx')
  const { default: HeroRadar } = load('src/components/home/HeroRadar.tsx', ui)
  const { default: Hero } = load('src/components/home/Hero.tsx', { ...ui, './data': data, './EditorialImage': esm(() => null), './HeroCover': esm(HeroCover), './HeroRadar': esm(HeroRadar) })
  const story = n => ({ id: `s${n}`, slug: `story-${n}`, hook: `이야기 ${n}`, category: '브랜딩', is_featured: false, created_at: '2026-10-20T00:00:00Z', article: { title: `Story ${n}`, source_name: '출처' } })
  const render = props => renderToStaticMarkup(createElement(Hero, props, null))
  const html = render({ story: story(1), radar: [story(2), story(3)] })
  assert.match(html, /<h1 id="hero-title">.*트렌드를 읽고,.*실무로 옮기다/)
  assert.deepEqual(links(html).filter(link => !link.href.startsWith('/insights/')).map(link => [link.text.trim(), link.href]), [['최신 인사이트 읽기', '/insights'], ['Brand Watch 보기', '/brands']])
  assert.equal((html.match(/fetchPriority="high"/g) ?? []).length, 1)
  assert.match(html, /<source media="\(max-width: 600px\)"[^>]*hero-v3-mobile-1170\.webp 1170w/)
  // Panel: all stories stay in the page with source and date; only the shown one is reachable; previous / next only.
  for (const n of [1, 2, 3]) assert.ok(html.includes(`href="/insights/story-${n}"`), `story ${n}`)
  assert.equal((html.match(/inert=""/g) ?? []).length, 2)
  assert.equal((html.match(/출처 · <time dateTime="2026-10-20T00:00:00Z">/g) ?? []).length, 3)
  for (const label of ['이전 이야기', '다음 이야기']) assert.ok(html.includes(`aria-label="${label}"`), label)
  assert.doesNotMatch(html, /자동 넘김|aria-pressed/)
  // No automatic advance: the panel has no timer, observer or progress bar (it changes only on previous / next).
  assert.doesNotMatch(readFileSync('src/components/home/HeroRadar.tsx', 'utf8'), /setTimeout|setInterval|IntersectionObserver|ml-radar-progress/)
  assert.match(html, /AI로 생성한 가상 인물/)
  assert.doesNotMatch(render({ story: story(1), radar: [] }), /aria-label="다음 이야기"/)
  const empty = render({ story: undefined, radar: [] })
  assert.match(empty, /발행된 인사이트를 준비하고 있습니다/); assert.doesNotMatch(empty, /href="\/insights\//)
})

test('career: Career Lab and its tools use the official names; URLs unchanged; no "Daily" quiz', () => {
  assert.deepEqual(navigation.CAREER_FEATURES.map(feature => [feature.name, feature.href]), [['Insight Lab', '/insight-lab'], ['AI Interview', '/interview'], ['Trend Quiz', '/learn']])
  const { default: Practice } = load('src/app/(public)/practice/page.tsx', { ...ui, '@/components/career/career.css': {} })
  const html = renderToStaticMarkup(createElement(Practice)), hrefs = links(html).map(link => link.href)
  for (const label of ['INSIGHT LAB', 'AI INTERVIEW', 'TREND QUIZ', 'Insight Lab', 'AI Interview', 'Trend Quiz']) assert.ok(html.includes(label), label)
  for (const href of ['/insight-lab', '/interview', '/interview/prep', '/learn']) assert.ok(hrefs.includes(href), href)
  // Each tool page names itself by its official name (CareerRoom eyebrow); the prep page belongs to AI Interview.
  for (const [file, eyebrow] of [['insight-lab/page.tsx', '01 / INSIGHT LAB'], ['interview/page.tsx', '02 / AI INTERVIEW'], ['interview/prep/page.tsx', '02 / AI INTERVIEW'], ['learn/page.tsx', '03 / TREND QUIZ']])
    assert.ok(readFileSync(`src/app/(public)/${file}`, 'utf8').includes(`eyebrow="${eyebrow}"`), file)
  const visible = ['src/app/(public)', 'src/components'].flatMap(dir => { const out = [], walk = d => { for (const name of readdirSync(d)) { const f = path.join(d, name); if (statSync(f).isDirectory()) walk(f); else if (f.endsWith('.tsx')) out.push(f) } }; walk(dir); return out })
  for (const file of visible) assert.doesNotMatch(readFileSync(file, 'utf8'), /DAILY TREND QUIZ|Daily Trend Quiz|CREATIVE STRATEGY TRAINING/, file)
})
