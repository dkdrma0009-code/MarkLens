import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

// TS/TSX loader: resolves relative and "@/" imports; next/navigation is stubbed for server rendering.
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
const routerCalls = []
const stubs = { 'next/navigation': { useRouter: () => ({ refresh: () => routerCalls.push('refresh') }), usePathname: () => '/admin/brand-watch' } }
function resolve(from, key) {
  const base = key.startsWith('@/') ? path.resolve('src', key.slice(2)) : path.resolve(path.dirname(from), key)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (existsSync(candidate) && !candidate.endsWith(path.sep)) try { if (readFileSync(candidate)) return candidate } catch { /* directory */ }
  throw new Error(`Cannot resolve ${key}`)
}
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  cache.set(file, loaded.exports)
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(key => stubs[key] ?? (key.startsWith('.') || key.startsWith('@/') ? load(resolve(file, key)) : require(key)), loaded, loaded.exports)
  cache.set(file, loaded.exports); return loaded.exports
}
const root = 'src/lib/brand-watch/'
const { launchRegistry } = load(root + 'registry.ts')
const { executeReviewCommand } = load(root + 'review/commands.ts')
const { fetchBrandWatchAdminRows } = load(root + 'admin/queries.ts')
const { buildAdminView } = load(root + 'admin/view.ts')
const { filterQueue, byBrand } = load(root + 'admin/filters.ts')
const { handleAdminReviewRequest, adminActor } = load(root + 'admin/actions.ts')
const { parseConsoleParams } = load(root + 'admin/constants.ts')
const { reviewMessage } = load(root + 'admin/messages.ts')
const { renderToStaticMarkup } = require('react-dom/server')
const { createElement } = require('react')
const BrandWatchConsole = load('src/components/admin-v2/brand-watch/BrandWatchConsole.tsx').default
const migrations = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle', '021_brand_watch_analysis_review_commands'].map(name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `e2000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const now = '2026-10-13T12:00:00Z', who = { actor: 'admin:reviewer@example.test', reason: 'Lineage and wording reviewed.' }
const emptyRows = () => ({ entities: [], aliases: [], profiles: [], providers: [], sources: [], matches: [], evidence: [], movements: [], movementEvidence: [], patterns: [], patternMovements: [], takes: [], takeEvidence: [], snapshots: [], snapshotTakes: [], events: [] })
const render = (view, initial = { tab: 'inbox', kind: 'patterns', brand: 'all', id: null }) => renderToStaticMarkup(createElement(BrandWatchConsole, { view, initial }))

// ---------- database fixtures (tests only) ----------
async function database() {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
  for (const sql of migrations) await db.exec(sql)
  return db
}
const rpc = db => ({ async rpc(fn, args) {
  const keys = Object.keys(args)
  await db.exec('SET ROLE service_role')
  try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
  catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
  finally { await db.exec('RESET ROLE') }
} })
// supabase-js query-builder subset (from/select/in/order/limit) over PGlite, returning PostgREST-shaped JSON rows.
const queryClient = db => ({ from: table => ({ select: columns => {
  const state = { where: [], order: null, limit: null }
  const builder = {
    in(column, values) { state.where.push([column, values]); return builder },
    order(column, options = {}) { state.order = `${column} ${options.ascending === false ? 'DESC' : 'ASC'} NULLS ${options.nullsFirst ? 'FIRST' : 'LAST'}`; return builder },
    limit(count) { state.limit = count; return builder },
    then(resolve, reject) {
      const sql = `SELECT row_to_json(t) AS row FROM (SELECT ${columns} FROM ${table}${state.where.length ? ` WHERE ${state.where.map(([column], index) => `${column} = ANY($${index + 1})`).join(' AND ')}` : ''}${state.order ? ` ORDER BY ${state.order}` : ''}${state.limit ? ` LIMIT ${state.limit}` : ''}) t`
      return (async () => {
        await db.exec('SET ROLE service_role')
        try { return { data: (await db.query(sql, state.where.map(([, values]) => values))).rows.map(row => row.row), error: null } }
        catch (error) { return { data: null, error: { message: error.message } } }
        finally { await db.exec('RESET ROLE') }
      })().then(resolve, reject)
    },
  }
  return builder
} }) })
const insert = async (db, table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
const review = (db, command) => executeReviewCommand(rpc(db), { ...who, ...command })
const facts = [
  { n: 1, entity: MUSINSA, title: 'MUSINSA Beauty Festa', type: 'campaign', day: '2026-10-01' },
  { n: 2, entity: MUSINSA, title: 'Beauty specialty store expansion', type: 'platform', day: '2026-10-05' },
  { n: 3, entity: MUSINSA, title: 'Beauty creator campaign', type: 'creator', day: '2026-10-08' },
  { n: 5, entity: TOSS, title: 'Toss card promotion', type: 'promotion', day: '2026-10-02' },
  { n: 6, entity: TOSS, title: 'Toss creator series', type: 'creator', day: '2026-10-06' },
]
async function seed(db) {
  for (const slug of ['musinsa', 'toss']) { const e = launchRegistry.find(row => row.slug === slug).entity; await insert(db, 'brand_entities', { id: e.id, slug: e.slug, name: e.name, name_ko: e.nameKo, entity_type: e.entityType, category: e.category }) }
  const source = async (n, entity, title, day) => {
    await insert(db, 'source_providers', { id: id(200 + n), name: `Provider ${n}`, domain: `p${n}.example.test`, provider_type: 'industry_media', source_tier: 2, reliability_policy: 'Attribution only', ingestion_method: 'manual' })
    await insert(db, 'source_items', { id: id(100 + n), provider_id: id(200 + n), canonical_url: `https://p${n}.example.test/a`, original_url: `https://p${n}.example.test/a`, title, date_precision: 'day', published_at: `${day}T00:00:00Z`, content_hash: String(n % 10).repeat(64), collected_at: `${day}T03:00:00Z` })
    await insert(db, 'source_entity_matches', { source_item_id: id(100 + n), entity_id: entity, role: 'mentioned', confidence: 0.7, method: 'model', review_status: 'pending' })
    await insert(db, 'brand_evidence', { id: id(10 + n), entity_id: entity, source_item_id: id(100 + n), fact: `Reviewed fact ${'abcdefghij'[n % 10]}`, support_text: 'Synthetic support span', support_locator: JSON.stringify({ validation: { result: 'support_validated_candidate' }, extraction: { entityRoleCandidate: 'primary' } }), event_date: day, date_precision: 'day', marketing_relevance: 1, confidence: 0.7, extraction_method: 'manual', review_status: 'pending' })
  }
  for (const f of facts) {
    await source(f.n, f.entity, f.title, f.day)
    assert.equal((await review(db, { command: 'evidence.approve', evidenceId: id(10 + f.n), matchRole: 'primary' })).ok, true)
    await insert(db, 'brand_movements', { id: id(f.n), entity_id: f.entity, event_key: `event-${f.n}`, title: f.title, summary: f.title, movement_type: f.type, scope: 'national', importance: 1, last_observed_at: `${f.day}T09:00:00Z` })
    await insert(db, 'movement_evidence', { entity_id: f.entity, movement_id: id(f.n), evidence_id: id(10 + f.n) })
    assert.equal((await review(db, { command: 'movement.approve', movementId: id(f.n) })).ok, true)
  }
  // An unreviewed source in the inbox.
  await source(7, MUSINSA, 'MUSINSA beauty pop-up announcement', '2026-10-11')
  await insert(db, 'brand_patterns', { id: id(50), entity_id: MUSINSA, title: 'Recurring beauty activity', description: 'Observed recurring beauty activity.', window_start: '2026-10-01', window_end: '2026-10-08', confidence: 0.6, uncertainties: ['Short window.'] })
  for (const m of [1, 2, 3]) await insert(db, 'pattern_movements', { entity_id: MUSINSA, pattern_id: id(50), movement_id: id(m) })
  await insert(db, 'brand_takes', { id: id(80), entity_id: MUSINSA, pattern_id: id(50), what_we_see: 'Seen.', why_it_may_matter: 'It may matter.', what_to_watch_next: 'Watch.', confidence: 0.6, uncertainties: ['Single pattern.'] })
  for (const e of [11, 12, 13]) await insert(db, 'take_evidence', { entity_id: MUSINSA, take_id: id(80), evidence_id: id(e) })
  await insert(db, 'brand_snapshots', { id: id(90), entity_id: MUSINSA, headline: 'Recurring beauty-focused marketing', body: 'Current direction.', watch_next: 'Watch next.', valid_from: '2026-10-08T09:00:00Z', evidence_count: 3, source_count: 3 })
  await insert(db, 'snapshot_takes', { entity_id: MUSINSA, snapshot_id: id(90), take_id: id(80) })
}
const handle = (db, command, actor = adminActor('Reviewer@Example.test')) => handleAdminReviewRequest({ command }, { actor, client: () => rpc(db) })
const loadView = async db => { const { rows, truncated } = await fetchBrandWatchAdminRows(queryClient(db)); return buildAdminView(rows, now, { truncated }) }

test('7/21: an empty database yields an honest empty console - zero KPIs, registry-only entities and providers, empty states', () => {
  const view = buildAdminView(emptyRows(), now)
  assert.deepEqual(view.kpis, { newSources: 0, reviewNeeded: 0, publishedMovements: 0, staleSnapshots: 0 })
  assert.deepEqual([view.sources, view.movements, view.patterns, view.takes, view.snapshots, view.events], [[], [], [], [], [], []])
  assert.deepEqual(view.entities.map(row => [row.slug, row.inDatabase, row.currentSnapshotId, row.healthSummary]), launchRegistry.map(row => [row.slug, false, null, null]))
  assert.ok(view.providers.every(row => row.inRegistry && !row.inDatabase && row.active === null && row.latestCollectedAt === null && row.loadedSourceCount === 0))
  const html = render(view)
  assert.match(html, /검수할 소스가 없습니다\./)
  assert.ok((html.match(/<strong>0<\/strong>/g) ?? []).length === 4)
  assert.match(render(view, { tab: 'analysis', kind: 'patterns', brand: 'all', id: null }), /아직 생성된 Pattern이 없습니다\./)
  assert.match(render(view, { tab: 'analysis', kind: 'snapshots', brand: 'all', id: null }), /게시된 브랜드 Snapshot이 없습니다\./)
  // A failed load renders an error state, never fallback numbers.
  const failed = render(null)
  assert.match(failed, /불러오지 못했습니다/); assert.doesNotMatch(failed, /<strong>\d+<\/strong>/)
})

test('1-6/14: DB read model - queue, brand and review filters, entity isolation, analysis listing, health and current pointer', async () => {
  const db = await database()
  try {
    await seed(db)
    let view = await loadView(db)
    // 7-day window ends 2026-10-06T12:00Z: sources from 10-08 and 10-11; review needed = 1 pending evidence + draft pattern, take and snapshot.
    assert.deepEqual(view.kpis, { newSources: 2, reviewNeeded: 4, publishedMovements: 5, staleSnapshots: 0 })
    const pending = view.sources.find(row => row.id === id(107))
    assert.deepEqual([pending.reviewState, pending.relevance, pending.providerName, pending.entityIds], ['needs_review', 'relevant', 'Provider 7', [MUSINSA]])
    const filters = { brand: 'all', review: 'all', type: 'all', relevance: 'all', query: '' }
    assert.equal(filterQueue(view.sources, view, filters).length, 6)
    assert.deepEqual(filterQueue(view.sources, view, { ...filters, review: 'needs_review' }).map(row => row.id), [id(107)])
    assert.ok(filterQueue(view.sources, view, { ...filters, brand: TOSS }).every(row => row.entityIds.every(entity => entity === TOSS)))
    assert.deepEqual(filterQueue(view.sources, view, { ...filters, query: 'pop-up' }).map(row => row.id), [id(107)])
    assert.deepEqual(filterQueue(view.sources, view, { ...filters, query: '토스' }).length, 2)
    assert.deepEqual(byBrand(view.movements, TOSS).map(row => row.id).sort(), [id(5), id(6)])
    assert.ok(byBrand(view.patterns, TOSS).length === 0 && byBrand(view.patterns, MUSINSA).length === 1)
    const pattern = view.patterns[0]
    assert.deepEqual([pattern.status, pattern.independentMovementCount, pattern.independentSourceCount, pattern.uncertainties, pattern.health.health], ['draft', 3, 3, ['Short window.'], 'HEALTHY'])
    assert.equal(view.movements.find(row => row.id === id(1)).mergeTargetIds.includes(id(5)), false)
    // Publish chain through the admin handler, then the snapshot becomes current.
    assert.equal((await handle(db, { command: 'pattern.publish', patternId: id(50), reason: 'ok' })).status, 200)
    assert.equal((await handle(db, { command: 'take.publish', takeId: id(80), reason: 'ok' })).status, 200)
    const published = await handle(db, { command: 'snapshot.publish', snapshotId: id(90), reason: 'ok' })
    assert.deepEqual([published.status, published.body.result.previousCurrentSnapshotId, published.body.result.snapshotId], [200, null, id(90)])
    view = await loadView(db)
    const snapshot = view.snapshots[0]
    assert.deepEqual([snapshot.isCurrent, snapshot.reviewedBy, view.entities.find(row => row.id === MUSINSA).currentSnapshotId, snapshot.patternIds, snapshot.movementIds.length], [true, 'admin:reviewer@example.test', id(90), [id(50)], 3])
    assert.deepEqual(view.events.filter(row => row.targetId === id(90)).map(row => [row.action, row.actor, row.revision]), [['publish', 'admin:reviewer@example.test', 1]])
    // Correction makes the published snapshot stale; the health model carries reasons for the UI.
    await review(db, { command: 'evidence.supersede', evidenceId: id(11), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })
    view = await loadView(db)
    assert.deepEqual([view.movements.find(row => row.id === id(1)).health.health, view.snapshots[0].health.health, view.kpis.staleSnapshots], ['REVIEW_REQUIRED', 'STALE', 1])
    assert.ok(view.movements.filter(row => row.entityId === TOSS).every(row => row.health.health === 'HEALTHY'))
    const html = render(view, { tab: 'analysis', kind: 'snapshots', brand: MUSINSA, id: id(90) })
    assert.match(html, /Stale/); assert.match(html, /상위 근거가 변경되어 최신이 아닙니다/); assert.match(html, /PUBLIC PREVIEW/); assert.match(html, /CURRENT/)
    assert.doesNotMatch(render(view, { tab: 'analysis', kind: 'takes', brand: MUSINSA, id: id(80) }), /class="bw-take"[^>]*>[^<]*FACT/)
    assert.match(render(view, { tab: 'analysis', kind: 'takes', brand: MUSINSA, id: id(80) }), /사실\(FACT\)이 아니라 MarkLens의 해석입니다/)
  } finally { await db.close() }
})

test('8-10/15/16/19: admin actions validate input, map typed errors and are safe to double-submit', async () => {
  const db = await database()
  try {
    await seed(db)
    assert.deepEqual(await handle(db, { command: 'evidence.approve', evidenceId: id(17), reason: 'ok' }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
    assert.deepEqual(await handle(db, { command: 'evidence.reject', evidenceId: id(17), reason: '  ' }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
    assert.deepEqual(await handle(db, { command: 'evidence.approve', evidenceId: 'not-a-uuid', matchRole: 'primary', reason: 'ok' }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
    assert.deepEqual(await handle(db, { command: 'movement.merge', sourceMovementId: id(1), targetMovementId: id(1), reason: 'ok' }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
    assert.deepEqual(await handle(db, { command: 'movement.merge', sourceMovementId: id(1), targetMovementId: id(5), reason: 'ok' }), { status: 409, body: { ok: false, code: 'ENTITY_MISMATCH' } })
    const first = await handle(db, { command: 'evidence.approve', evidenceId: id(17), matchRole: 'primary', reason: 'Checked.' })
    const second = await handle(db, { command: 'evidence.approve', evidenceId: id(17), matchRole: 'primary', reason: 'Checked.' })
    assert.deepEqual([first.status, second.status, second.body.code], [200, 409, 'INVALID_TRANSITION'])
    assert.equal((await db.query("SELECT count(*)::int AS n FROM brand_watch_review_events WHERE target_id=$1", [id(17)])).rows[0].n, 1)
    // Raw database messages never reach the response; operator messages are typed.
    const leaky = await handleAdminReviewRequest({ command: { command: 'pattern.publish', patternId: id(50), reason: 'ok' } }, { actor: 'admin:x', client: () => ({ rpc: async () => ({ data: null, error: { message: 'secret row data: users table' } }) }) })
    assert.deepEqual(leaky, { status: 500, body: { ok: false, code: 'DATABASE_ERROR' } })
    assert.ok(!JSON.stringify(leaky).includes('secret'))
    assert.match(reviewMessage('ENTITY_MISMATCH'), /다른 브랜드/); assert.equal(reviewMessage('UNKNOWN_CODE'), reviewMessage('DATABASE_ERROR'))
  } finally { await db.close() }
})

test('17/18: unauthenticated or spoofed requests never reach an RPC; service-role access stays server-side', async () => {
  let called = 0
  const client = () => ({ rpc: async () => { called++; return { data: {}, error: null } } })
  assert.deepEqual(await handleAdminReviewRequest({ command: { command: 'pattern.publish', patternId: id(50), reason: 'ok' } }, { actor: null, client }), { status: 401, body: { ok: false, code: 'UNAUTHORIZED' } })
  assert.deepEqual(await handleAdminReviewRequest({ command: { command: 'pattern.publish', patternId: id(50), reason: 'ok', actor: 'admin:spoofed' } }, { actor: 'admin:real', client }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
  assert.deepEqual(await handleAdminReviewRequest(null, { actor: 'admin:real', client }), { status: 400, body: { ok: false, code: 'INVALID_COMMAND' } })
  assert.equal(called, 0)
  // Client modules and client-imported libraries never touch the service-role client or environment.
  const clientFiles = [...readdirSync('src/components/admin-v2/brand-watch').filter(name => name.endsWith('.tsx')).map(name => `src/components/admin-v2/brand-watch/${name}`), ...['filters', 'messages', 'constants'].map(name => `${root}admin/${name}.ts`)]
  for (const file of clientFiles) {
    const source = readFileSync(file, 'utf8')
    if (file.endsWith('.tsx')) assert.match(source, /^"use client"/, file)
    assert.doesNotMatch(source, /supabase\/admin|SERVICE_ROLE|process\.env|createAdminClient/, file)
    for (const match of source.matchAll(/^import (?!type )[^\n]*from "@\/lib\/brand-watch\/admin\/(\w+)"/gm)) assert.ok(['filters', 'messages', 'constants'].includes(match[1]), `${file} imports ${match[1]}`)
  }
  const page = readFileSync('src/app/admin/brand-watch/page.tsx', 'utf8'), route = readFileSync('src/app/api/admin/brand-watch/review/route.ts', 'utf8')
  assert.ok(page.indexOf('await requireAdmin()') > -1 && page.indexOf('await requireAdmin()') < page.indexOf('createAdminClient()'))
  assert.doesNotMatch(page, /"use client"/)
  assert.match(route, /getAdminEmail\(\)/); assert.match(route, /adminActor\(email\)/)
  const view = buildAdminView(emptyRows(), now)
  assert.doesNotMatch(JSON.stringify(view), /service_role|SUPABASE|eyJ/)
})

test('19/20: URL state is validated and the existing Admin navigation is preserved with Brand Watch under Intelligence', () => {
  assert.deepEqual(parseConsoleParams({ tab: 'analysis', kind: 'takes', brand: MUSINSA, id: id(1) }), { tab: 'analysis', kind: 'takes', brand: MUSINSA, id: id(1) })
  assert.deepEqual(parseConsoleParams({ tab: 'drop table', kind: 'x', brand: "' or 1=1", id: ['a', 'b'] }), { tab: 'inbox', kind: 'patterns', brand: 'all', id: null })
  const shell = readFileSync('src/components/admin-v2/AdminShell.tsx', 'utf8')
  const hrefs = [...shell.matchAll(/href: "([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(hrefs, ['/admin', '/admin/articles', '/admin/insights', '/admin/cardnews', '/admin/newsletter', '/admin/calendar', '/admin/adkit', '/admin/subscribers', '/admin/feedback', '/admin/analytics', '/admin/brand-watch', '/admin/sources', '/admin/insight-lab'])
  assert.match(shell, /label: "Intelligence", items: \[\s*\{ href: "\/admin\/analytics"[^\n]*\n\s*\{ href: "\/admin\/brand-watch", label: "Brand Watch"/)
  for (const route of ['articles', 'insights', 'cardnews', 'newsletter', 'calendar', 'adkit', 'subscribers', 'feedback', 'analytics', 'sources', 'insight-lab']) assert.ok(existsSync(`src/app/admin/${route}/page.tsx`), route)
})
