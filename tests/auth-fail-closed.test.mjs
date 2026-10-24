import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as releaseGuard from '../src/lib/release/guard.mjs'

// R-1: an environment without CRON_SECRET or ADMIN_EMAIL (a fresh Preview, a typo) must deny, not match
// "Bearer undefined" or a signed-in user without an email. The real modules run with their imports stubbed.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const stub = new Proxy(function () {}, { get: (_, key) => key === '__esModule' ? false : stub, apply: () => stub })
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/lib/release/guard.mjs' ? releaseGuard : name.startsWith('@/') || name.startsWith('.') ? stub : require(name), loaded, loaded.exports)
  return loaded.exports
}
const json = (body, init) => ({ status: init?.status ?? 200, body })
const server = { NextResponse: { json, next: () => ({ status: 200, cookies: { set() {} }, headers: { set() {} } }), redirect: url => ({ status: 307, url: String(url) }) } }
const withEnv = async (env, run) => {
  const set = values => { for (const [k, v] of Object.entries(values)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]))
  set(env)
  try { return await run() } finally { set(saved) }
}

const CRONS = ['collect', 'curation-weekly', 'ig-daily', 'newsletter', 'quiz-seed']
test('cron: "Bearer undefined" is refused when CRON_SECRET is not configured', async () => {
  for (const name of CRONS) {
    const { GET } = load(`src/app/api/cron/${name}/route.ts`, { 'next/server': server })
    const res = await withEnv({ CRON_SECRET: undefined }, () => GET(new Request('https://x.test/api/cron/' + name, { headers: { authorization: 'Bearer undefined' } })))
    assert.equal(res.status, 401, name)
  }
})

const userClient = user => ({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) } })
test('admin: a user without an email is never admin when ADMIN_EMAIL is not configured; the configured admin still is', async () => {
  const noEmail = load('src/lib/api-auth.ts', userClient({ id: 'anon' }))
  assert.equal(await withEnv({ ADMIN_EMAIL: undefined }, () => noEmail.isAdmin()), false)
  assert.equal(await withEnv({ ADMIN_EMAIL: '' }, () => noEmail.isAdmin()), false)
  const admin = load('src/lib/api-auth.ts', userClient({ id: 'a', email: 'Admin@Example.test ' }))
  assert.equal(await withEnv({ ADMIN_EMAIL: 'admin@example.test' }, () => admin.isAdmin()), true)
  assert.equal(await withEnv({ ADMIN_EMAIL: 'other@example.test' }, () => admin.isAdmin()), false)

  let redirected = 0
  const { requireAdmin } = load('src/lib/auth.ts', { ...userClient({ id: 'anon' }), 'next/navigation': { redirect: () => { redirected++; throw new Error('redirect') } } })
  await withEnv({ ADMIN_EMAIL: undefined }, () => requireAdmin().catch(() => null))
  assert.equal(redirected, 1)

  const { proxy } = load('src/proxy.ts', { 'next/server': server, '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'anon' } } }) } }) }, '@/lib/insights/legacy-redirects.json': {} })
  const request = pathname => ({ nextUrl: { pathname, searchParams: new URLSearchParams(), protocol: 'https:', clone() { return { ...this } } }, url: 'https://x.test' + pathname, cookies: { getAll: () => [] } })
  assert.equal((await withEnv({ ADMIN_EMAIL: undefined }, () => proxy(request('/api/admin/health')))).status, 401)
  assert.equal((await withEnv({ ADMIN_EMAIL: undefined }, () => proxy(request('/admin')))).status, 307)
})

test('admin: no inline admin or cron check compares against a value that may be unset', () => {
  const sites = execSync('git grep -n -E "=== adminEmail|!== adminEmail|Bearer \\$\\{process.env.CRON_SECRET\\}" -- src', { encoding: 'utf8' }).trim().split('\n')
  assert.ok(sites.length >= 25, `found ${sites.length}`)
  for (const line of sites) assert.match(line, /!!adminEmail|!adminEmail|adminEmail && email === adminEmail|!process\.env\.CRON_SECRET/, line)
})
