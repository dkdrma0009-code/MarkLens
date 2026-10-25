import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REQUIRED, copyRowCounts, parseReadinessCsv, verifyBackup } from '../scripts/release/verify-backup.mjs'

// R-4 step A: the production backup is only "taken" once its files prove complete — never from the dump's exit code.
const table = t => { const [s, n] = t.split('.'); return `CREATE TABLE IF NOT EXISTS "${s}"."${n}" (\n    "id" uuid NOT NULL\n);\n` }
const copy = (t, n) => { const [s, x] = t.split('.'); return `COPY "${s}"."${x}" ("id") FROM stdin;\n${Array.from({ length: n }, (_, i) => `row-${i}`).join('\n')}${n ? '\n' : ''}\\.\n\n` }

function backup(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ml-backup-'))
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text)
  return dir
}

test('backup check: complete dump passes, row counts come from COPY blocks without reading values', () => {
  const dir = backup({
    'roles.sql': 'CREATE ROLE "x";\n',
    'schema.sql': REQUIRED.filter(t => t.startsWith('public.')).map(table).join('') + 'CREATE POLICY "p" ON "public"."articles";\nCREATE OR REPLACE FUNCTION "public"."f"() RETURNS void;\n',
    'data.sql': REQUIRED.map((t, i) => copy(t, i)).join(''),
  })
  try {
    const r = verifyBackup(dir, parseReadinessCsv('item,value\ncount: insights,1\n"count: auth users",6\n'))
    assert.deepEqual(r.problems, [])
    assert.equal(r.rows['public.insights'], 1); assert.equal(r.rows['auth.users'], 6); assert.equal(r.rows['public.articles'], 0)
    assert.equal(r.schema.tables, 6); assert.equal(r.schema.policies, 1); assert.equal(r.schema.functions, 1)
    assert.equal(r.files['data.sql'].sha256.length, 64)
    assert.equal(JSON.stringify(r).includes('row-'), false) // no row content in the result
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('backup check: empty files, a missing table and fewer rows than production are INCOMPLETE', () => {
  const dir = backup({ 'roles.sql': '', 'schema.sql': table('public.articles'), 'data.sql': copy('public.insights', 2) })
  try {
    const r = verifyBackup(dir, { 'count: insights': '5' })
    assert.ok(r.problems.includes('roles.sql missing or empty'))
    assert.ok(r.problems.includes('schema.sql has no table public.cardnews'))
    assert.ok(r.problems.includes('data.sql has no COPY block for auth.users'))
    assert.ok(r.problems.some(p => p.startsWith('public.insights: backup has 2 rows, production had 5')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('backup check: COPY parsing handles unquoted names, empty tables and CRLF', () => {
  assert.deepEqual(copyRowCounts('COPY public.a (id) FROM stdin;\r\n1\r\n2\r\n\\.\r\nCOPY "auth"."users" ("id") FROM stdin;\n\\.\n'), { 'public.a': 2, 'auth.users': 0 })
})

test('backup script: production-only, password never echoed, documented dump commands, output outside the repository', () => {
  const ps = readFileSync('scripts/release/backup-production.ps1', 'utf8')
  assert.match(ps, /Read-Host -AsSecureString/)
  assert.match(ps, /\$ProdRef = "ndehtnchkgvpjbxlkazk"/); assert.match(ps, /\$ref -ne \$Expected/); assert.match(ps, /Test-ProductionConnection \$raw \$ProdRef/)
  assert.match(ps, /if \(\$check\.Problem\) \{ throw/) // refused before any dump
  assert.match(ps, /Set-Clipboard -Value " "/) // -FromClipboard does not leave the password behind
  assert.match(ps, /--role-only/); assert.match(ps, /--use-copy", "--data-only"/)
  assert.match(ps, /\$Cli = "supabase@\d+\.\d+\.\d+"/) // pinned CLI version
  assert.match(ps, /Join-Path \$HOME "MarkLens-backups"/)
  assert.ok(ps.indexOf('Push-Location $dir') > -1 && ps.indexOf('Push-Location $dir') < ps.indexOf('db dump')) // CLI never runs inside a checkout with .env files
  assert.doesNotMatch(ps, /Write-Host[^\n]*\$(url|raw)\b/)
  assert.doesNotMatch(ps, /[^\x00-\x7F]/) // Windows PowerShell 5.1 reads BOM-less scripts in the ANSI code page
})

test('backup script: the connection check accepts production strings and names the reason for every other input', { skip: process.platform !== 'win32' }, () => {
  const P = 'ndehtnchkgvpjbxlkazk', H = 'aws-0-ap-northeast-2.pooler.supabase.com', SECRET = 'Zq9secretpw42'
  const cases = {
    pooler: [`postgresql://postgres.${P}:${SECRET}@${H}:5432/postgres`, null],
    direct: [`postgresql://postgres:${SECRET}@db.${P}.supabase.co:5432/postgres`, null],
    padded: [`  "postgresql://postgres.${P}:${SECRET}@${H}:5432/postgres"\r\n`, null],
    psqlFormat: [`psql "postgresql://postgres.${P}:${SECRET}@${H}:5432/postgres"`, null],
    envFormat: [`DATABASE_URL=postgresql://postgres.${P}:${SECRET}@${H}:5432/postgres`, null],
    twoStrings: [`postgresql://postgres.${P}:${SECRET}@${H}:6543/postgres\npostgresql://postgres.${P}:${SECRET}@${H}:5432/postgres`, /2 connection strings/],
    ctrlv: ['\u0016', /control character/],
    empty: ['', /empty/],
    passwordOnly: [SECRET, /not a connection string/],
    placeholder: [`postgresql://postgres.${P}:[YOUR-PASSWORD]@${H}:5432/postgres`, /placeholder/],
    brackets: [`postgresql://postgres.${P}:[${SECRET}]@${H}:5432/postgres`, /wrapped in \[ \]/],
    unencoded: [`postgresql://postgres.${P}:a@b${SECRET}@${H}:5432/postgres`, /percent-encode/],
    preview: [`postgresql://postgres.umysmkhttlupmhttjzwi:${SECRET}@${H}:5432/postgres`, /project umysmkhttlupmhttjzwi, not production/],
    noRef: [`postgresql://postgres:${SECRET}@${H}:5432/postgres`, /no Supabase project ID/],
  }
  const script = [`. '${path.resolve('scripts/release/backup-production.ps1')}'`, '$out = [ordered]@{}']
  for (const [k, [input]] of Object.entries(cases)) script.push(`$r = Test-ProductionConnection ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(input).toString('base64')}'))) '${P}'; $out['${k}'] = @{ problem = $r.Problem; clean = ($r.Url -and $r.Url.StartsWith('postgresql://') -and $r.Url.EndsWith('/postgres')) }`)
  script.push('$out | ConvertTo-Json -Compress')
  const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script.join('; ')], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  const out = JSON.parse(res.stdout)
  for (const [k, [, reason]] of Object.entries(cases)) {
    if (reason) assert.match(out[k].problem ?? '', reason, k)
    else { assert.equal(out[k].problem, null, k); assert.equal(out[k].clean, true, k) }
    assert.equal(String(out[k].problem).includes(SECRET), false, `${k}: password never in the reason`)
  }
})
