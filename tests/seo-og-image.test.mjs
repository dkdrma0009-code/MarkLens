import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-1: Next merges metadata shallowly, so a page that defines `openGraph` replaces the root's and loses the
// site-wide image (home, Dictionary and Brand Watch shipped without og:image). Every page-level openGraph lists one.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), loaded, loaded.exports)
  return loaded.exports
}

test('seo: every openGraph object below the root layout carries an image', () => {
  const files = execSync('git grep -l "openGraph: {" -- src', { encoding: 'utf8' }).trim().split('\n').filter(file => file !== 'src/app/layout.tsx')
  let objects = 0
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (let at = source.indexOf('openGraph: {'); at >= 0; at = source.indexOf('openGraph: {', at + 1)) {
      let depth = 0, end = at + 'openGraph: '.length
      do { if (source[end] === '{') depth++; else if (source[end] === '}') depth-- ; end++ } while (depth > 0 && end < source.length)
      objects++
      assert.match(source.slice(at, end), /\bimages\b/, `${file}: ${source.slice(at, at + 80)}`)
    }
  }
  assert.ok(objects >= 5, `found ${objects}`)
})

test('seo: Brand Watch metadata uses the site Open Graph image for the index and every brand state', () => {
  const og = load('src/lib/og.ts', {})
  const meta = load('src/lib/brand-watch/public/metadata.ts', { '@/lib/og': og })
  const brand = { slug: 'musinsa', nameKo: '무신사' }
  for (const metadata of [meta.brandsIndexMetadata([{ kind: 'available', brand }]), meta.brandMetadata({ kind: 'available', brand, indexable: false, snapshot: null }), meta.brandMetadata({ kind: 'error', brand })]) {
    assert.deepEqual(metadata.openGraph.images, [og.SITE_OG_IMAGE])
  }
  assert.deepEqual(og.SITE_OG_IMAGE, { url: '/opengraph-image', width: 1200, height: 630, alt: 'MarkLens — Where Marketing Trends Become Action' })
  assert.match(readFileSync('src/app/opengraph-image.tsx', 'utf8'), /size = \{ width: 1200, height: 630 \}/)
})
