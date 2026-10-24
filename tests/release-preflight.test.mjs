import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSchema, preflightChecks } from '../scripts/release/preflight.mjs'

// R-3 release gate: one verdict from git, env, guard simulation, schema and verification runs. UNKNOWN never passes.
const SECRET = 'do-not-print-7f3a9c'
const base = { NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRET, SUPABASE_SERVICE_ROLE_KEY: SECRET, ADMIN_EMAIL: 'admin@example.test', CRON_SECRET: SECRET, N8N_WEBHOOK_SECRET: SECRET }
const previewEnv = { ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://previewtestproject01.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens-git-release.vercel.app', MARKLENS_DEPLOYMENT: 'preview' }
const productionEnv = { ...base, NEXT_PUBLIC_SUPABASE_URL: 'https://ndehtnchkgvpjbxlkazk.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://marklens.site', BREVO_API_KEY: SECRET, GEMINI_API_KEY: SECRET }
const migrations = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'))
const schemaCheckSql = readFileSync('scripts/release/check-production-schema.sql', 'utf8')
const allPresent = migrations.map(f => f.slice(0, 3)).filter(n => n !== '005').map(migration => ({ migration, present: true }))
const cleanGit = { branch: 'release/x', dirty: [], containsMaster: true, pushed: true, trackedEnvFiles: [] }
const green = { typecheck: { ok: true }, lint: { ok: true }, tests: { ok: true, skipped: 0 }, build: { ok: true } }
const gate = input => preflightChecks({ migrations, schemaCheckSql, ...input })
const level = (res, name) => res.results.find(r => r.name === name)?.level

test('gate: everything known and green → PASS, for both targets', async () => {
  assert.equal((await gate({ target: 'preview', env: previewEnv, schema: allPresent, git: cleanGit, runs: green })).verdict, 'PASS')
  assert.equal((await gate({ target: 'production', env: productionEnv, schema: allPresent, git: cleanGit, runs: green })).verdict, 'PASS')
})

test('gate: missing inputs are UNKNOWN, never PASS', async () => {
  const res = await gate({ target: 'preview' })
  assert.equal(res.verdict, 'UNKNOWN')
  for (const name of ['repository', 'environment file', 'guard simulation', 'target database schema', 'AI quota (024) present', 'tests', 'build']) assert.equal(level(res, name), 'UNKNOWN', name)
  // Skipped SQL tests are not a pass either.
  assert.equal(level(await gate({ target: 'preview', env: previewEnv, schema: allPresent, git: cleanGit, runs: { ...green, tests: { ok: true, skipped: 3 } } }), 'tests'), 'UNKNOWN')
})

test('gate: a Preview that could reach production, or a database without 023/024, FAILs', async () => {
  const shared = await gate({ target: 'preview', env: { ...previewEnv, NEXT_PUBLIC_SUPABASE_URL: productionEnv.NEXT_PUBLIC_SUPABASE_URL }, schema: allPresent, git: cleanGit, runs: green })
  assert.equal(shared.verdict, 'FAIL')
  assert.equal(level(shared, 'NEXT_PUBLIC_SUPABASE_URL (isolation)'), 'FAIL'); assert.equal(level(shared, 'database usable (isolated)'), 'FAIL')
  assert.equal(level(shared, 'external actions blocked'), 'PASS'); assert.equal(level(shared, 'egress refused (IG, Threads, Brevo)'), 'PASS')

  const unforced = await gate({ target: 'preview', env: { ...previewEnv, MARKLENS_DEPLOYMENT: undefined }, schema: allPresent, git: cleanGit, runs: green })
  assert.equal(level(unforced, 'classified as preview without Vercel system env'), 'FAIL')

  const old = await gate({ target: 'production', env: productionEnv, schema: allPresent.map(r => ({ ...r, present: !['023', '024'].includes(r.migration) })), git: cleanGit, runs: green })
  assert.equal(old.verdict, 'FAIL')
  assert.match(old.results.find(r => r.name === 'target database schema').detail, /023, 024/)
  assert.equal(level(old, 'AI quota (024) present'), 'FAIL')

  const forced = await gate({ target: 'production', env: { ...productionEnv, MARKLENS_DEPLOYMENT: 'preview' }, schema: allPresent, git: cleanGit, runs: green })
  assert.equal(level(forced, 'production features not blocked'), 'FAIL')
})

test('gate: git — dirty tree, tracked env files and (for production) a branch behind master fail', async () => {
  const res = await gate({ target: 'production', env: productionEnv, schema: allPresent, runs: green, git: { ...cleanGit, dirty: [' M x'], containsMaster: false, trackedEnvFiles: ['.env.local'] } })
  for (const name of ['clean working tree', 'contains origin/master', 'no tracked env files']) assert.equal(level(res, name), 'FAIL', name)
  const preview = await gate({ target: 'preview', env: previewEnv, schema: allPresent, runs: green, git: { ...cleanGit, containsMaster: false, pushed: false } })
  assert.equal(preview.verdict, 'PASS') // not yet pushed / behind master: warnings for a Preview
  assert.equal(level(preview, 'HEAD pushed'), 'WARN')
})

test('gate: every local migration is covered by the schema check; schema CSV and JSON downloads parse', async () => {
  assert.equal(level(await gate({ target: 'preview' }), 'local migrations covered by schema check'), 'PASS')
  assert.equal(level(await gate({ target: 'preview', migrations: [...migrations, '025_new.sql'] }), 'local migrations covered by schema check'), 'FAIL')
  assert.deepEqual(parseSchema('migration,artifact,present\n001,"tables a/b",true\n023,x,false\n'), [{ migration: '001', present: true }, { migration: '023', present: false }])
  assert.deepEqual(parseSchema('[{"migration":"024","artifact":"x","present":true}]'), [{ migration: '024', present: true }])
})

test('cli: npm run release:preflight prints names and verdicts only, exits 0/1/2', () => {
  assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).scripts['release:preflight'], 'node scripts/release/preflight.mjs')
  const dir = mkdtempSync(path.join(tmpdir(), 'ml-gate-'))
  try {
    const envFile = path.join(dir, '.env'), schemaFile = path.join(dir, 'schema.csv')
    writeFileSync(envFile, Object.entries(previewEnv).map(([k, v]) => `${k}="${v}"`).join('\n'))
    writeFileSync(schemaFile, 'migration,artifact,present\n' + allPresent.map(r => `${r.migration},x,true`).join('\n'))
    const run = spawnSync(process.execPath, ['scripts/release/preflight.mjs', '--target', 'preview', '--env', envFile, '--schema', schemaFile], { encoding: 'utf8' })
    assert.ok([1, 2].includes(run.status), run.stdout) // tests/build not run here → at best UNKNOWN
    assert.match(run.stdout, /PASS\s+external actions blocked/)
    assert.ok(!(run.stdout + run.stderr).includes(SECRET), 'a value was printed')
    assert.equal(spawnSync(process.execPath, ['scripts/release/preflight.mjs'], { encoding: 'utf8' }).status, 64)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
