import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-1: /insights reads the category with useSearchParams, which drops its Suspense boundary from prerendering. With
// fallback={null} the static HTML had no insight at all (list only after JS: CLS 0.57 on mobile, nothing to crawl).
// The fallback is now the "all" feed, rendered by the same component the client shows.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const { createElement } = require('react'), { renderToStaticMarkup } = require('react-dom/server')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports
}
const esm = value => ({ __esModule: true, default: value })
const Link = ({ href, children, ...rest }) => createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) }, children)
const card = n => ({ id: `i${n}`, slug: `story-${n}`, hook: `이야기 ${n}`, summary: '요약', category: n % 2 ? '브랜딩' : 'CRM', tags: [], created_at: '2026-10-20T00:00:00Z', article: { title: `Story ${n}` } })
const mod = load('src/app/(public)/insights/InsightsClient.tsx', {
  'next/navigation': { useSearchParams: () => new URLSearchParams('category=CRM') },
  'next/link': esm(Link), 'lucide-react': new Proxy({}, { get: () => () => null }),
  '@/components/insights/EditorialInsight': esm(({ insight }) => createElement('a', { href: `/insights/${insight.slug}` }, insight.hook)),
})

test('insights list: the fallback feed server-renders the first page of insights and every category link', () => {
  const all = Array.from({ length: 20 }, (_, i) => card(i + 1))
  const html = renderToStaticMarkup(createElement(mod.InsightsFeed, { allInsights: all, category: '' }))
  const stories = [...new Set([...html.matchAll(/href="\/insights\/(story-\d+)"/g)].map(m => m[1]))]
  assert.equal(stories.length, 12)
  assert.match(html, /20개의 인사이트/)
  assert.match(html, /<a href="\/insights" aria-current="page">전체<\/a>/)
  // The client component filters by the URL category exactly as before.
  const filtered = renderToStaticMarkup(createElement(mod.default, { allInsights: all }))
  assert.match(filtered, /10개의 인사이트/)
  const page = readFileSync('src/app/(public)/insights/page.tsx', 'utf8')
  assert.match(page, /<Suspense fallback=\{<InsightsFeed allInsights=\{cards\} category="" \/>\}>/)
  assert.doesNotMatch(page, /fallback=\{null\}/)
})
