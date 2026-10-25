import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Chapter C-1 Insight detail: reading order (lead → contents → what happened → why → take → apply → tools), contents
// that always point at a rendered section, no placeholder art, one subscribe form, the AI entry inside the text, and
// related insights only when something actually overlaps. Rendered with the real components and plain stand-ins.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports
}
const { createElement } = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const esm = value => ({ __esModule: true, default: value })
const Link = ({ href, children, ...rest }) => createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([, value]) => typeof value !== 'function')) }, children)
const icons = { 'lucide-react': new Proxy({}, { get: () => () => null }) }
const ArticleVisual = load('src/components/insights/ArticleVisual.tsx', {
  '@/lib/images': { isHotlinkBlocked: () => false },
  '@/lib/editorial-images': { editorialImage: () => null },
  '@/components/media/CdnImage': esm(({ src }) => createElement('img', { src })),
})
const { default: ArticleStory } = load('src/components/insights/ArticleStory.tsx', {
  'next/link': esm(Link), ...icons, './ArticleVisual': ArticleVisual,
  '@/components/InsightQuiz': esm(() => createElement('div', null, 'quiz')),
  '@/components/InterviewSoundbites': esm(({ items }) => createElement('div', null, items.join(' '))),
  '@/components/ShareButtons': esm(() => null),
})
const { rankRelated } = load('src/lib/insights/related.ts')

const full = {
  id: 'i1', slug: 'standard', category: '브랜딩', created_at: '2026-09-12T00:00:00Z', hook: '할인 대신 적립', summary: '리드 문장.',
  key_takeaways: ['하나', '둘', '셋'], why_it_matters: '왜 1\n왜 2', framework_analysis: '해석 1\n해석 2',
  practical_applications: '첫째, 재방문을 본다.\n둘째, 등급을 나눈다.', portfolio_usage: '포트폴리오 문장', interview_points: ['면접 한 마디'],
  quiz: { question: 'Q?', options: ['a', 'b'], answer: 0, explanation: 'e' },
  article: { title: 'Source title', source_name: 'Marketing Week', url: 'https://example.test/a', image_url: 'https://example.test/a.jpg' },
}
const terms = [{ term: 'LTV', definition: '고객 생애 가치' }]
const render = (insight, t = terms) => renderToStaticMarkup(createElement(ArticleStory, { insight, title: insight.hook, terms: t, color: '#164bff' }))
const ids = html => [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1])

test('detail: the lead comes before the image, the contents after it, then the article in reading order', () => {
  const html = render(full)
  const at = needle => { const i = html.indexOf(needle); assert.ok(i >= 0, needle); return i }
  assert.ok(at('id="summary"') < at('<figure') && at('<figure') < at('class="ml-article-toc"') && at('class="ml-article-toc"') < at('id="takeaways"'))
  assert.deepEqual(ids(html).filter(id => ['takeaways', 'why', 'framework', 'apply', 'tools'].includes(id)), ['takeaways', 'why', 'framework', 'apply', 'tools'])
  assert.match(html, /<h2 id="summary-title" class="sr-only">핵심 요약<\/h2>/)
  assert.match(html, /원문 제목<\/span>Source title/)
})

test('detail: every contents entry points at a rendered section; short articles get no tools entry and no empty block', () => {
  for (const insight of [full, { ...full, framework_analysis: null, practical_applications: null, portfolio_usage: null, interview_points: null, quiz: null }]) {
    const t = insight === full ? terms : []
    const html = render(insight, t), present = new Set(ids(html))
    const targets = [...html.matchAll(/<nav[^>]*ml-article-toc[\s\S]*?<\/nav>/g)].flatMap(([nav]) => [...nav.matchAll(/href="#([^"]+)"/g)].map(m => m[1]))
    assert.ok(targets.length >= 2)
    for (const id of targets) assert.ok(present.has(id), `contents → #${id}`)
    if (insight !== full) { assert.ok(!present.has('tools')); assert.ok(!html.includes('이 글로 해볼 것')) }
  }
})

test('detail: tools name only what is there; ordinal steps are numbered; no English section labels or decorative blue', () => {
  const html = render(full)
  assert.match(html, /포트폴리오 문장, 면접 한 마디, 용어, 퀴즈 — 이 글의 내용으로 만든 도구입니다\./)
  assert.match(html, /<h3>포트폴리오에 활용하기<\/h3>/)
  assert.match(html, /<ol class="ml-article-steps"><li><span>01<\/span><p><span>재방문을 본다\.<\/span><\/p><\/li><li><span>02<\/span>/)
  assert.doesNotMatch(html, /WHAT HAPPENED|WHY IT MATTERS|MARKLENS TAKE|HOW TO USE IT|FROM INSIGHT TO CAREER|IN THIS STORY|READ \/ THINK|ml-blue/)
  const mixed = render({ ...full, practical_applications: '첫째, 하나.\n마무리 문장.' })
  assert.ok(!mixed.includes('ml-article-steps'), 'only all-ordinal paragraphs become steps')
})

test('detail: no usable image renders no figure and no placeholder art', () => {
  const html = render({ ...full, article: { ...full.article, image_url: null, fallback_image: null } })
  assert.ok(!html.includes('<figure'))
  assert.ok(!html.includes('기사 이미지 없음') && !html.includes('MARKETING × TREND'))
})

test('related: only insights that share a tag, keyword or category, best first, newest first on ties, at most three', () => {
  const me = { tags: ['멤버십', 'CRM'], keywords: ['적립'], category: '브랜딩' }
  const c = (slug, tags, category = '물류', keywords = []) => ({ slug, tags, keywords, category })
  const pool = [c('none-1', ['콜드체인']), c('cat', [], '브랜딩'), c('one-tag', ['crm']), c('two', ['멤버십'], '물류', ['적립']), c('none-2', null), c('cat-2', [], '브랜딩')]
  assert.deepEqual(rankRelated(me, pool).map(r => r.slug), ['two', 'one-tag', 'cat'])
  assert.deepEqual(rankRelated(me, [c('only', ['CRM'])]).map(r => r.slug), ['only'])
  assert.deepEqual(rankRelated(me, []), [])
  assert.deepEqual(rankRelated(me, [c('a', ['콜드체인']), c('b', null), c('c', [], '물류', ['배송'])]), [])
})

test('page: one subscribe form, the related empty state, and the AI entry in the text', () => {
  const page = readFileSync('src/app/(public)/insights/[slug]/page.tsx', 'utf8')
  assert.equal(page.match(/<NewsletterInlineCta /g).length, 1)
  assert.doesNotMatch(page, /insight_mid|midCta|ml-blue/)
  assert.match(page, /아직 이 글과 주제가 겹치는 인사이트가 없습니다\./)
  assert.doesNotMatch(readFileSync('src/components/ArticleFeedback.tsx', 'utf8'), /\/api\/subscribe/)
  // The hidden lead heading must not take the global h2 face at weight 400 (it downloaded Gmarket Sans Medium, 360KB).
  assert.match(readFileSync('src/app/(public)/insights/insights.css', 'utf8'), /\.ml-article-lede > h2 \{ font: inherit; \}/)
  const { default: ArticleChat } = load('src/components/ArticleChat.tsx', icons)
  const chat = renderToStaticMarkup(createElement(ArticleChat, { context: 'c', color: '#164bff' }))
  assert.match(chat, /^<button[^>]*aria-expanded="false"[^>]*class="ml-article-ask-button"[^>]*>AI에게 이 글에 대해 묻기 <span aria-hidden="true">→<\/span><\/button>$/)
})
