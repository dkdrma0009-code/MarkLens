// Local-only HTML preview; never calls database, AI, send or subscription routes.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { newsletterVariants } from '../tests/fixtures/newsletter-email.mjs'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function newsletterRenderer() {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const loaded = { exports: {} }; cache.set(file, loaded)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const localRequire = name => name.startsWith('@/') ? load(resolve(root, 'src', `${name.slice(2)}.ts`)) : require(name)
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports)
    return loaded.exports
  }
  return load(resolve(root, 'src/lib/newsletter/html.ts'))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { buildNewsletterHtml } = newsletterRenderer()
  const storedIssue = process.env.NEWSLETTER_PREVIEW_ISSUE ? JSON.parse(readFileSync(process.env.NEWSLETTER_PREVIEW_ISSUE, "utf8")) : null
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const name = url.searchParams.get('fixture') || 'modern'
    const variant = name === 'stored' ? storedIssue : newsletterVariants[name]
    if (!variant) { res.writeHead(404); res.end('Fixture not found'); return }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(buildNewsletterHtml(variant, { unsubscribeUrl: '#test-only-unsubscribe' }))
  })
  server.listen(3016, '127.0.0.1', () => console.log('TEST ONLY email preview: http://127.0.0.1:3016/?fixture=modern'))
}
