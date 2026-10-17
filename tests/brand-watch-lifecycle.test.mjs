import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(key => key.startsWith('.') ? load(path.resolve(path.dirname(file), key + '.ts')) : require(key), loaded, loaded.exports)
  cache.set(file, loaded.exports); return loaded.exports
}
const root = 'src/lib/brand-watch/'
const { launchRegistry } = load(root + 'registry.ts')
const { executeReviewCommand } = load(root + 'review/commands.ts')
const { generatePatternCandidates } = load(root + 'patterns/generate.ts')
const { generateTakeCandidates } = load(root + 'takes/generate.ts')
const { generateSnapshotCandidate } = load(root + 'snapshots/generate.ts')
const { lifecyclePolicySchema } = load(root + 'lifecycle/policy.ts')
const { evaluateLineageHealth, correctionImpact } = load(root + 'lifecycle/health.ts')
const { savePatternDraft, saveTakeDraft, saveSnapshotDraft } = load(root + 'lifecycle/persistence.ts')
const migrations = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle'].map(name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))
const [m018, m019, m020] = migrations

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z', confidence = { score: 0.9, basis: 'Reviewed lineage of distinct approved movements.' }
const who = { actor: 'admin:reviewer@example.test', reason: 'Checked against the cited source.' }
const saveFunctions = ['brand_watch_save_pattern_draft', 'brand_watch_save_take_draft', 'brand_watch_save_snapshot_draft']

// ---------- pure health / freshness ----------
function ev(n, day, changes = {}) {
  return { id: id(10 + n), entityId: MUSINSA, sourceItemId: id(100 + n), fact: `Reviewed fact ${'abcdefghij'[n]}`, eventDate: day, reviewStatus: 'approved', status: 'active', marketingRelevance: 1, matchRole: 'primary', matchReviewStatus: 'approved',
    source: { providerId: id(200 + n), providerType: 'industry_media', canonicalUrl: `https://p${n}.example.test/a`, contentHash: String(n).repeat(64), publishedAt: null }, ...changes }
}
const titles = ['', 'Beauty Festa', 'Beauty store expansion', 'Beauty creator campaign', 'Sneaker collaboration drop']
const types = ['', 'campaign', 'platform', 'creator', 'partnership']
function mv(n, day, changes = {}, evidenceChanges = {}) {
  return { id: id(n), entityId: MUSINSA, eventKey: `event-${n}`, title: titles[n], summary: titles[n], movementType: types[n], status: 'published', mergedIntoId: null, startedAt: null, lastObservedAt: `${day}T09:00:00Z`, evidence: [ev(n, day, evidenceChanges)], ...changes }
}
function graph(changes = {}) {
  return {
    movements: [mv(1, '2026-09-01'), mv(2, '2026-09-15'), mv(3, '2026-10-01'), mv(4, '2026-09-20')],
    patterns: [{ id: id(50), entityId: MUSINSA, title: 'Recurring beauty activity', description: 'Beauty activity recurred.', windowStart: '2026-09-01', windowEnd: '2026-10-01', status: 'published', revision: 1, movementIds: [id(1), id(2), id(3)] }],
    takes: [{ id: id(60), entityId: MUSINSA, patternId: id(50), status: 'published', revision: 1, whatWeSee: 'Seen.', whyItMayMatter: 'It may matter.', whatToWatchNext: 'Watch.', evidenceIds: [id(11), id(12), id(13)] }],
    snapshots: [{ id: id(70), entityId: MUSINSA, status: 'published', revision: 1, asOf: '2026-10-01T09:00:00Z', takeIds: [id(60)], evidenceCount: 3, sourceCount: 3 }],
    ...changes,
  }
}
const health = (report, kind, n) => report.results.find(row => row.kind === kind && row.id === id(n))

test('11: an intact lineage is HEALTHY at every layer with no action', () => {
  const report = evaluateLineageHealth(graph(), generatedAt)
  assert.deepEqual(report.summary, { HEALTHY: 7, STALE: 0, REVIEW_REQUIRED: 0, BROKEN: 0 })
  assert.ok(report.results.every(row => row.action === 'NONE' && row.causes.length === 0))
  assert.equal(health(report, 'pattern', 50).latestSupportingDate, '2026-10-01')
})

test('1-6/12: evidence correction propagates movement REVIEW_REQUIRED -> pattern/take/snapshot STALE, others unaffected', () => {
  const g = graph(); g.movements[0] = mv(1, '2026-09-01', {}, { status: 'superseded' })
  const report = evaluateLineageHealth(g, generatedAt)
  assert.deepEqual([health(report, 'movement', 1).health, health(report, 'movement', 1).reasons, health(report, 'movement', 1).action], ['REVIEW_REQUIRED', ['EVIDENCE_CORRECTED'], 'HUMAN_REVIEW'])
  assert.deepEqual([health(report, 'pattern', 50).health, health(report, 'pattern', 50).reasons], ['STALE', ['UPSTREAM_IMPACTED']])
  assert.deepEqual([health(report, 'take', 60).health, health(report, 'take', 60).reasons], ['STALE', ['UPSTREAM_IMPACTED', 'EVIDENCE_CORRECTED']])
  assert.deepEqual([health(report, 'snapshot', 70).health, health(report, 'snapshot', 70).action], ['STALE', 'REGENERATION_CANDIDATE'])
  for (const n of [2, 3, 4]) assert.equal(health(report, 'movement', n).health, 'HEALTHY')
  assert.deepEqual(correctionImpact(report, `evidence:${id(11)}`).map(row => `${row.kind}:${row.id}`), [`movement:${id(1)}`, `pattern:${id(50)}`, `take:${id(60)}`, `snapshot:${id(70)}`])
  assert.deepEqual(correctionImpact(report, `evidence:${id(14)}`), [])
})

test('retired (merged/superseded) movements stale their analyses; the retired row itself needs no action', () => {
  const g = graph(); g.movements[0] = mv(1, '2026-09-01', { status: 'superseded', mergedIntoId: id(2) })
  const report = evaluateLineageHealth(g, generatedAt)
  assert.deepEqual([health(report, 'movement', 1).retired, health(report, 'movement', 1).action], [true, 'NONE'])
  assert.deepEqual(health(report, 'pattern', 50).reasons, ['MOVEMENT_RETIRED'])
  assert.equal(health(report, 'snapshot', 70).health, 'STALE')
})

test('13: structural breaks are BROKEN and dependents of broken lineage require review', () => {
  const cases = [
    [graph({ patterns: [{ ...graph().patterns[0], movementIds: [id(1), id(2), id(99)] }] }), 'pattern', 50, 'MISSING_MOVEMENT'],
    [graph({ movements: [...graph().movements, { ...mv(3, '2026-10-01'), id: id(5), eventKey: 'event-5', title: 'Beauty Festa', movementType: 'campaign', lastObservedAt: '2026-09-02T09:00:00Z', evidence: [ev(5, '2026-09-02')] }], patterns: [{ ...graph().patterns[0], movementIds: [id(1), id(5)] }], takes: [], snapshots: [] }), 'pattern', 50, 'INSUFFICIENT_INDEPENDENT_MOVEMENTS'],
    [graph({ movements: [...graph().movements, { ...mv(4, '2026-09-20'), id: id(6), entityId: TOSS, evidence: [ev(6, '2026-09-20', { entityId: TOSS })] }], patterns: [{ ...graph().patterns[0], movementIds: [id(1), id(2), id(6)] }] }), 'pattern', 50, 'CROSS_ENTITY_MOVEMENT'],
    [graph({ takes: [{ ...graph().takes[0], evidenceIds: [id(11), id(14)] }], snapshots: [{ ...graph().snapshots[0], evidenceCount: 2, sourceCount: 2 }] }), 'take', 60, 'EVIDENCE_UNREACHABLE'],
    [graph({ snapshots: [{ ...graph().snapshots[0], sourceCount: 9 }] }), 'snapshot', 70, 'COVERAGE_COUNT_MISMATCH'],
    [graph({ snapshots: [{ ...graph().snapshots[0], takeIds: [] }] }), 'snapshot', 70, 'NO_TAKE_LINEAGE'],
  ]
  for (const [g, kind, n, reason] of cases) {
    const row = health(evaluateLineageHealth(g, generatedAt), kind, n)
    assert.equal(row.health, 'BROKEN', reason); assert.ok(row.reasons.includes(reason), reason); assert.equal(row.action, 'HUMAN_REVIEW')
  }
  const g = graph(); g.movements[1] = mv(2, '2026-09-15', {}, { matchRole: 'mentioned' })
  const report = evaluateLineageHealth(g, generatedAt)
  assert.deepEqual([health(report, 'movement', 2).health, health(report, 'movement', 2).reasons], ['BROKEN', ['UNAPPROVED_ACTOR_ROLE']])
  assert.deepEqual([health(report, 'pattern', 50).health, health(report, 'pattern', 50).reasons], ['REVIEW_REQUIRED', ['UPSTREAM_BROKEN']])
  assert.equal(health(report, 'take', 60).health, 'STALE')
})

test('9/10: freshness is deterministic and fully policy-driven', () => {
  const at = asOf => evaluateLineageHealth(graph(), asOf)
  assert.equal(health(at('2026-12-30T00:00:00Z'), 'pattern', 50).health, 'HEALTHY')
  const expired = at('2026-12-31T00:00:00Z')
  assert.deepEqual([health(expired, 'pattern', 50).reasons, health(expired, 'take', 60).reasons], [['FRESHNESS_EXPIRED'], ['UPSTREAM_IMPACTED']])
  assert.deepEqual(health(expired, 'snapshot', 70).reasons, ['UPSTREAM_IMPACTED', 'FRESHNESS_EXPIRED'])
  assert.deepEqual(at('2026-12-31T00:00:00Z'), expired)
  const relaxed = evaluateLineageHealth(graph(), '2027-03-01T00:00:00Z', { patternFreshnessDays: 365, snapshotFreshnessDays: 365 })
  assert.equal(relaxed.summary.HEALTHY, 7)
  const snapshotOnly = evaluateLineageHealth(graph(), '2026-11-15T00:00:00Z', { snapshotFreshnessDays: 30 })
  assert.deepEqual([health(snapshotOnly, 'pattern', 50).health, health(snapshotOnly, 'snapshot', 70).reasons], ['HEALTHY', ['FRESHNESS_EXPIRED']])
  for (const bad of [{ minIndependentMovements: 1 }, { patternFreshnessDays: 0 }, { snapshotFreshnessDays: 'x' }, { unknown: 1 }]) assert.throws(() => lifecyclePolicySchema.parse(bad))
  assert.throws(() => evaluateLineageHealth({ ...graph(), extra: [] }, generatedAt))
  assert.throws(() => evaluateLineageHealth(graph({ patterns: [graph().patterns[0], graph().patterns[0]] }), generatedAt), /DUPLICATE_GRAPH_ID/)
})

test('8: lifecycle code never calls a model or regenerates analyses', () => {
  for (const file of ['policy', 'health', 'persistence']) {
    const source = readFileSync(`${root}lifecycle/${file}.ts`, 'utf8')
    assert.doesNotMatch(source, /runStructuredAI|BrandWatchAITransport|generate(Pattern|Take|Snapshot)|\.generate\(/)
  }
  for (const name of Object.keys({ ...load(root + 'lifecycle/health.ts'), ...load(root + 'lifecycle/persistence.ts') })) assert.doesNotMatch(name, /publish|approve|regenerate/i)
})

// ---------- database ----------
async function database({ apply020 = true } = {}) {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
  await db.exec(m018); await db.exec(m019)
  if (apply020) { await db.exec(m020); await db.exec(m020) }
  return db
}
// The supabase-js rpc contract, executed as service_role in one autocommit statement.
const rpc = db => ({ async rpc(fn, args) {
  const keys = Object.keys(args)
  await db.exec('SET ROLE service_role')
  try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
  catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
  finally { await db.exec('RESET ROLE') }
} })
const insert = async (db, table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]
const review = (db, command) => executeReviewCommand(rpc(db), { ...who, ...command })
function transport(value) {
  const provider = { provider: 'mock-gemini', model: 'fixture-model-v1', calls: 0, async generate() { provider.calls++; return { kind: 'text', text: JSON.stringify(value) } } }
  return provider
}

const facts = [
  { n: 1, entity: MUSINSA, title: 'MUSINSA Beauty Festa', type: 'campaign', day: '2026-09-01' },
  { n: 2, entity: MUSINSA, title: 'Beauty specialty store expansion', type: 'platform', day: '2026-09-15' },
  { n: 3, entity: MUSINSA, title: 'Beauty creator campaign', type: 'creator', day: '2026-10-01' },
  { n: 4, entity: MUSINSA, title: 'Sneaker collaboration drop', type: 'partnership', day: '2026-09-20' },
  { n: 5, entity: TOSS, title: 'Toss card promotion', type: 'promotion', day: '2026-09-05' },
  { n: 6, entity: TOSS, title: 'Toss creator series', type: 'creator', day: '2026-09-25' },
]
// Source -> pending Evidence -> 4A approval -> draft Movement -> 4A approval, all through real SQL and commands.
async function seedFacts(db) {
  for (const slug of ['musinsa', 'toss']) { const e = launchRegistry.find(row => row.slug === slug).entity; await insert(db, 'brand_entities', { id: e.id, slug: e.slug, name: e.name, name_ko: e.nameKo, entity_type: e.entityType, category: e.category }) }
  for (const f of facts) {
    await insert(db, 'source_providers', { id: id(200 + f.n), name: 'Synthetic', domain: `p${f.n}.example.test`, provider_type: 'industry_media', source_tier: 2, reliability_policy: 'Attribution only', ingestion_method: 'manual' })
    await insert(db, 'source_items', { id: id(100 + f.n), provider_id: id(200 + f.n), canonical_url: `https://p${f.n}.example.test/a`, original_url: `https://p${f.n}.example.test/a`, title: f.title, date_precision: 'day', published_at: `${f.day}T00:00:00Z`, content_hash: String(f.n).repeat(64) })
    await insert(db, 'source_entity_matches', { source_item_id: id(100 + f.n), entity_id: f.entity, role: 'mentioned', confidence: 0.7, method: 'model', review_status: 'pending' })
    await insert(db, 'brand_evidence', { id: id(10 + f.n), entity_id: f.entity, source_item_id: id(100 + f.n), fact: `Reviewed fact ${'abcdefghij'[f.n]}`, support_text: 'Synthetic support span', event_date: f.day, date_precision: 'day', marketing_relevance: 1, confidence: 0.7, extraction_method: 'manual', review_status: 'pending' })
    assert.equal((await review(db, { command: 'evidence.approve', evidenceId: id(10 + f.n), matchRole: 'primary' })).ok, true)
    await insert(db, 'brand_movements', { id: id(f.n), entity_id: f.entity, event_key: `event-${f.n}`, title: f.title, summary: f.title, movement_type: f.type, scope: 'national', importance: 1, last_observed_at: `${f.day}T09:00:00Z` })
    await insert(db, 'movement_evidence', { entity_id: f.entity, movement_id: id(f.n), evidence_id: id(10 + f.n) })
    assert.equal((await review(db, { command: 'movement.approve', movementId: id(f.n) })).ok, true)
  }
}
const ts_ = column => `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')`
// Loads reviewed rows into the camelCase engine/health input shapes.
async function loadGraph(db, entityId = null) {
  const where = entityId ? 'WHERE entity_id=$1' : '', params = entityId ? [entityId] : []
  const movements = []
  for (const m of (await db.query(`SELECT id,entity_id,event_key,title,summary,movement_type,status,merged_into_id,${ts_('started_at')} started_at,${ts_('last_observed_at')} last_observed_at FROM brand_movements ${where} ORDER BY id`, params)).rows) {
    const evidence = (await db.query(`SELECT e.id,e.entity_id,e.source_item_id,e.fact,to_char(e.event_date,'YYYY-MM-DD') event_date,e.review_status,e.status,e.marketing_relevance::float8 relevance,sm.role,sm.review_status match_status,s.provider_id,p.provider_type,s.canonical_url,s.content_hash,${ts_('s.published_at')} published_at
      FROM movement_evidence me JOIN brand_evidence e ON e.id=me.evidence_id JOIN source_items s ON s.id=e.source_item_id JOIN source_providers p ON p.id=s.provider_id
      LEFT JOIN source_entity_matches sm ON sm.source_item_id=e.source_item_id AND sm.entity_id=e.entity_id WHERE me.movement_id=$1 ORDER BY e.id`, [m.id])).rows
    movements.push({ id: m.id, entityId: m.entity_id, eventKey: m.event_key, title: m.title, summary: m.summary, movementType: m.movement_type, status: m.status, mergedIntoId: m.merged_into_id, startedAt: m.started_at, lastObservedAt: m.last_observed_at,
      evidence: evidence.map(e => ({ id: e.id, entityId: e.entity_id, sourceItemId: e.source_item_id, fact: e.fact, eventDate: e.event_date, reviewStatus: e.review_status, status: e.status, marketingRelevance: e.relevance, matchRole: e.role, matchReviewStatus: e.match_status,
        source: { providerId: e.provider_id, providerType: e.provider_type, canonicalUrl: e.canonical_url, contentHash: e.content_hash, publishedAt: e.published_at } })) })
  }
  const patterns = (await db.query(`SELECT id,entity_id,title,description,to_char(window_start,'YYYY-MM-DD') ws,to_char(window_end,'YYYY-MM-DD') we,status,revision,(SELECT coalesce(array_agg(movement_id ORDER BY movement_id),'{}') FROM pattern_movements WHERE pattern_id=p.id) ids FROM brand_patterns p ${where} ORDER BY id`, params)).rows
    .map(p => ({ id: p.id, entityId: p.entity_id, title: p.title, description: p.description, windowStart: p.ws, windowEnd: p.we, status: p.status, revision: p.revision, movementIds: p.ids }))
  const takes = (await db.query(`SELECT *,(SELECT coalesce(array_agg(evidence_id ORDER BY evidence_id),'{}') FROM take_evidence WHERE take_id=t.id) ids FROM brand_takes t ${where} ORDER BY id`, params)).rows
    .map(t => ({ id: t.id, entityId: t.entity_id, patternId: t.pattern_id, status: t.status, revision: t.revision, whatWeSee: t.what_we_see, whyItMayMatter: t.why_it_may_matter, whatToWatchNext: t.what_to_watch_next, evidenceIds: t.ids }))
  const snapshots = (await db.query(`SELECT id,entity_id,status,revision,${ts_('valid_from')} as_of,evidence_count,source_count,(SELECT coalesce(array_agg(take_id ORDER BY take_id),'{}') FROM snapshot_takes WHERE snapshot_id=s.id) ids FROM brand_snapshots s ${where} ORDER BY id`, params)).rows
    .map(s => ({ id: s.id, entityId: s.entity_id, status: s.status, revision: s.revision, asOf: s.as_of, takeIds: s.ids, evidenceCount: s.evidence_count, sourceCount: s.source_count }))
  return { movements, patterns, takes, snapshots }
}

const patternOutput = (movementNs, entity = 'musinsa') => ({ patterns: [{ title: entity === 'musinsa' ? 'Recurring beauty-related marketing activity' : 'Recurring Toss creator and promotion activity', description: 'Approved movements show related marketing activity recurring across separate events.', movementIds: movementNs.map(id), evidenceIds: movementNs.map(n => id(10 + n)), uncertainties: ['Short window.'], confidence }], noPatternReason: null })
const takeOutput = (patternId, movementNs) => ({ takes: [{ patternIds: [patternId], movementIds: movementNs.map(id), evidenceIds: movementNs.map(n => id(10 + n)), whatWeSee: 'The reviewed movements show related marketing activity recurring across separate events.', whyItMayMatter: '이는 브랜드 접점을 넓히려는 움직임일 수 있다.', whatToWatchNext: 'Watch whether further related campaigns follow.', uncertainties: ['Single pattern.'], confidence }], noTakeReason: null })
const snapshotOutput = (patternId, takeId) => ({ snapshot: { headline: 'Recurring beauty-focused marketing', currentDirection: 'Reviewed movements show beauty-related marketing recurring; MarkLens reads this as a possible widening of brand touchpoints.', watchNext: 'Watch whether further beauty campaigns follow.', keyMovementIds: [id(1), id(2), id(3)], keyPatternIds: [patternId], keyTakeIds: [takeId], uncertainties: ['Single take.'], confidence }, noSnapshotReason: null })

async function patternCandidate(db, entityId, movementNs, slug = 'musinsa') {
  const g = await loadGraph(db, entityId), provider = transport(patternOutput(movementNs, slug))
  const result = await generatePatternCandidates({ entityId, movements: g.movements, existingPatterns: g.patterns.map(p => ({ id: p.id, entityId: p.entityId, title: p.title, status: p.status, revision: p.revision, movementIds: p.movementIds })) }, [provider], generatedAt)
  return { candidate: result.candidates[0], provider, result }
}
async function takeCandidate(db, entityId, patternId, movementNs) {
  const g = await loadGraph(db, entityId), provider = transport(takeOutput(patternId, movementNs))
  const result = await generateTakeCandidates({ entityId, patterns: g.patterns, movements: g.movements, existingTakes: g.takes.map(t => ({ id: t.id, entityId: t.entityId, patternId: t.patternId, status: t.status, revision: t.revision })) }, [provider], generatedAt)
  return { candidate: result.candidates[0], provider, result }
}
async function snapshotCandidate(db, patternId, takeId) {
  const g = await loadGraph(db, MUSINSA), provider = transport(snapshotOutput(patternId, takeId))
  const result = await generateSnapshotCandidate({ entityId: MUSINSA, movements: g.movements, patterns: g.patterns, takes: g.takes, existingSnapshots: g.snapshots.map(s => ({ id: s.id, entityId: s.entityId, status: s.status, revision: s.revision })) }, [provider], generatedAt)
  return { candidate: result.candidate, provider, result }
}
// Pattern/Take/Snapshot review commands do not exist yet (Chapter 5); tests simulate the human publish step in SQL.
const simulateReviewedPublish = (db, table, rowId) => db.query(`UPDATE ${table} SET status='published'${table === 'brand_snapshots' ? ",reviewed_by='reviewer',reviewed_at=now()" : ''} WHERE id=$1`, [rowId])

test('22/23/20/21: 020 applies, is repeat-safe, rolls back atomically, keeps RLS and grants save RPCs to service_role only', async () => {
  const db = await database()
  try {
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).n, 19)
    for (const [table, column] of [['brand_patterns', 'uncertainties'], ['brand_takes', 'confidence'], ['brand_takes', 'uncertainties'], ['brand_snapshots', 'confidence'], ['brand_snapshots', 'uncertainties'], ['brand_snapshots', 'watch_next']])
      assert.equal((await one(db, 'SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2', [table, column])).n, 1, column)
    for (const row of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).rows) {
      assert.equal((await one(db, 'SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [row.tablename])).relrowsecurity, true)
      for (const role of ['anon', 'authenticated']) assert.equal((await one(db, "SELECT has_table_privilege($1,$2,'SELECT') AS ok", [role, row.tablename])).ok, false)
    }
    const signatures = (await db.query("SELECT oid::regprocedure::text AS s FROM pg_proc WHERE proname = ANY($1)", [saveFunctions])).rows.map(row => row.s)
    assert.equal(signatures.length, 3)
    for (const signature of signatures) {
      for (const role of ['anon', 'authenticated']) assert.equal((await one(db, "SELECT has_function_privilege($1,$2,'EXECUTE') AS ok", [role, signature])).ok, false)
      assert.equal((await one(db, "SELECT has_function_privilege('service_role',$1,'EXECUTE') AS ok", [signature])).ok, true)
      assert.equal((await one(db, "SELECT count(*)::int AS n FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure AND a.grantee=0", [signature])).n, 0)
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`)
      await assert.rejects(db.query(`SELECT public.brand_watch_save_snapshot_draft(${Array(17).fill('NULL').join(',')})`), /permission denied/)
      await db.exec('RESET ROLE')
    }
  } finally { await db.close() }
  // Transactional apply: a rolled back or failing 020 leaves no trace; a clean apply afterwards succeeds.
  const fresh = await database({ apply020: false })
  try {
    const exists = async () => (await one(fresh, "SELECT count(*)::int AS n FROM pg_proc WHERE proname = ANY($1)", [saveFunctions])).n + (await one(fresh, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='brand_snapshots' AND column_name='watch_next'")).n
    await fresh.exec(m020.replace(/COMMIT;\s*$/, 'ROLLBACK;'))
    assert.equal(await exists(), 0)
    await assert.rejects(fresh.exec(m020.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;")))
    await fresh.exec('ROLLBACK')
    assert.equal(await exists(), 0)
    await fresh.exec(m020); await fresh.exec(m020)
    assert.equal(await exists(), 4)
  } finally { await fresh.close() }
})

test('14-16/19: pattern draft save is atomic, duplicate-safe, revision-safe and preserves the predecessor', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    const { candidate } = await patternCandidate(db, MUSINSA, [1, 2])
    const saved = await savePatternDraft(rpc(db), candidate)
    assert.deepEqual(saved, { ok: true, result: { patternId: candidate.id, noop: false } })
    assert.deepEqual({ ...(await one(db, 'SELECT status,uncertainties,revision,supersedes_id FROM brand_patterns WHERE id=$1', [candidate.id])) }, { status: 'draft', uncertainties: candidate.uncertainties, revision: 1, supersedes_id: null })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM pattern_movements WHERE pattern_id=$1', [candidate.id])).n, 2)
    // Retry is a no-op; same movement set under another ID is a duplicate; reused ID with other content conflicts.
    assert.deepEqual(await savePatternDraft(rpc(db), candidate), { ok: true, result: { patternId: candidate.id, noop: true } })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM pattern_movements WHERE pattern_id=$1', [candidate.id])).n, 2)
    assert.deepEqual(await savePatternDraft(rpc(db), { ...candidate, id: id(901) }), { ok: false, code: 'DUPLICATE' })
    assert.deepEqual(await savePatternDraft(rpc(db), { ...candidate, movementIds: [id(1), id(3)], evidenceIds: [id(11)] }), { ok: false, code: 'ID_CONFLICT' })
    assert.deepEqual(await savePatternDraft(rpc(db), { ...candidate, duplicate: { ...candidate.duplicate, decision: 'POSSIBLE_DUPLICATE', matchedPatternId: candidate.id } }), { ok: false, code: 'DUPLICATE' })
    // Ineligible lineage (another entity's movement) never writes.
    assert.deepEqual(await savePatternDraft(rpc(db), { ...candidate, id: id(902), movementIds: [id(1), id(5)] }), { ok: false, code: 'INELIGIBLE_LINEAGE' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_patterns')).n, 1)
    // Revision: a published predecessor gets exactly one successor; a competing successor fails as a whole.
    await simulateReviewedPublish(db, 'brand_patterns', candidate.id)
    const next = (await patternCandidate(db, MUSINSA, [1, 2, 3])).candidate
    assert.deepEqual([next.duplicate.decision, next.duplicate.revision], ['REVISION_CANDIDATE', 2])
    assert.equal((await savePatternDraft(rpc(db), next)).ok, true)
    const rival = { ...next, id: id(903), movementIds: [id(1), id(2), id(4)], evidenceIds: [id(11)] }
    assert.deepEqual(await savePatternDraft(rpc(db), rival), { ok: false, code: 'SUCCESSOR_EXISTS' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM pattern_movements WHERE pattern_id=$1', [id(903)])).n, 0)
    assert.deepEqual({ ...(await one(db, 'SELECT status,revision FROM brand_patterns WHERE id=$1', [candidate.id])) }, { status: 'published', revision: 1 })
    await assert.rejects(db.query("UPDATE brand_patterns SET uncertainties='{edited}' WHERE id=$1", [candidate.id]), /immutable/)
    // Atomic rollback: a failure while linking leaves no pattern row.
    await db.exec("CREATE FUNCTION fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated link failure'; END $$; CREATE TRIGGER fail_link BEFORE INSERT ON pattern_movements FOR EACH ROW EXECUTE FUNCTION fail_link();")
    const before = (await one(db, 'SELECT count(*)::int AS n FROM brand_patterns')).n
    assert.deepEqual(await savePatternDraft(rpc(db), { ...next, id: id(904), movementIds: [id(2), id(3), id(4)], evidenceIds: [id(12)], duplicate: { decision: 'NEW', matchedPatternId: null, revision: 1, matches: [] } }), { ok: false, code: 'DATABASE_ERROR' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_patterns')).n, before)
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_patterns WHERE id=$1', [id(904)])).n, 0)
  } finally { await db.close() }
})

test('17/19: take draft save is atomic, lineage-checked, duplicate-safe and revision-safe', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    const pattern = (await patternCandidate(db, MUSINSA, [1, 2, 3])).candidate
    assert.equal((await savePatternDraft(rpc(db), pattern)).ok, true)
    const draftTake = (await takeCandidate(db, MUSINSA, pattern.id, [1, 2, 3]))
    assert.equal(draftTake.result.status, 'NO_ELIGIBLE_PATTERN')
    await simulateReviewedPublish(db, 'brand_patterns', pattern.id)
    const { candidate } = await takeCandidate(db, MUSINSA, pattern.id, [1, 2, 3])
    assert.deepEqual(await saveTakeDraft(rpc(db), candidate), { ok: true, result: { takeId: candidate.id, noop: false } })
    assert.deepEqual({ ...(await one(db, 'SELECT status,confidence::float8 c,uncertainties FROM brand_takes WHERE id=$1', [candidate.id])) }, { status: 'draft', c: 0.75, uncertainties: ['Single pattern.'] })
    assert.equal((await saveTakeDraft(rpc(db), candidate)).result.noop, true)
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM take_evidence WHERE take_id=$1', [candidate.id])).n, 3)
    assert.deepEqual(await saveTakeDraft(rpc(db), { ...candidate, id: id(911) }), { ok: false, code: 'DUPLICATE' })
    assert.deepEqual(await saveTakeDraft(rpc(db), { ...candidate, id: id(912), evidenceIds: [id(11), id(14)] }), { ok: false, code: 'INELIGIBLE_LINEAGE' })
    await simulateReviewedPublish(db, 'brand_takes', candidate.id)
    assert.deepEqual(await saveTakeDraft(rpc(db), { ...candidate, id: id(913) }), { ok: false, code: 'REVISION_REQUIRED' })
    const next = (await takeCandidate(db, MUSINSA, pattern.id, [1, 2, 3])).candidate
    assert.deepEqual([next.existing.decision, next.existing.revision], ['REVISION_CANDIDATE', 2])
    await db.exec("CREATE FUNCTION fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated link failure'; END $$; CREATE TRIGGER fail_link BEFORE INSERT ON take_evidence FOR EACH ROW EXECUTE FUNCTION fail_link();")
    assert.deepEqual(await saveTakeDraft(rpc(db), next), { ok: false, code: 'DATABASE_ERROR' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_takes WHERE id=$1', [next.id])).n, 0)
    await db.exec('DROP TRIGGER fail_link ON take_evidence')
    assert.equal((await saveTakeDraft(rpc(db), next)).ok, true)
    assert.deepEqual((await db.query('SELECT status,revision FROM brand_takes ORDER BY revision')).rows.map(row => [row.status, row.revision]), [['published', 1], ['draft', 2]])
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM take_evidence WHERE take_id=$1', [candidate.id])).n, 3)
  } finally { await db.close() }
})

test('18/19: snapshot draft save is atomic, count-checked, stores watch_next separately and is revision-safe', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    const pattern = (await patternCandidate(db, MUSINSA, [1, 2, 3])).candidate
    await savePatternDraft(rpc(db), pattern); await simulateReviewedPublish(db, 'brand_patterns', pattern.id)
    const take = (await takeCandidate(db, MUSINSA, pattern.id, [1, 2, 3])).candidate
    await saveTakeDraft(rpc(db), take)
    // An unreviewed take cannot be cited; a take-less save is refused below (no anchored lineage).
    const unreviewed = (await snapshotCandidate(db, pattern.id, take.id)).result
    assert.deepEqual([unreviewed.status, unreviewed.issues], ['REJECTED', ['INELIGIBLE_TAKE_ID']])
    await simulateReviewedPublish(db, 'brand_takes', take.id)
    const { candidate } = await snapshotCandidate(db, pattern.id, take.id)
    assert.deepEqual(await saveSnapshotDraft(rpc(db), { ...candidate, keyTakeIds: [] }), { ok: false, code: 'LINEAGE_REQUIRED' })
    assert.deepEqual(await saveSnapshotDraft(rpc(db), { ...candidate, storedCoverage: { evidenceCount: 3, sourceCount: 2 } }), { ok: false, code: 'COVERAGE_COUNT_MISMATCH' })
    await db.exec("CREATE FUNCTION fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated link failure'; END $$; CREATE TRIGGER fail_link BEFORE INSERT ON snapshot_takes FOR EACH ROW EXECUTE FUNCTION fail_link();")
    assert.deepEqual(await saveSnapshotDraft(rpc(db), candidate), { ok: false, code: 'DATABASE_ERROR' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_snapshots')).n, 0)
    await db.exec('DROP TRIGGER fail_link ON snapshot_takes')
    assert.deepEqual(await saveSnapshotDraft(rpc(db), candidate), { ok: true, result: { snapshotId: candidate.id, noop: false } })
    const row = await one(db, 'SELECT status,body,watch_next,reviewed_by,evidence_count,source_count,uncertainties FROM brand_snapshots WHERE id=$1', [candidate.id])
    assert.deepEqual({ ...row }, { status: 'draft', body: candidate.currentDirection, watch_next: candidate.watchNext, reviewed_by: null, evidence_count: 3, source_count: 3, uncertainties: ['Single take.'] })
    assert.equal((await saveSnapshotDraft(rpc(db), candidate)).result.noop, true)
    assert.deepEqual(await saveSnapshotDraft(rpc(db), { ...candidate, id: id(921) }), { ok: false, code: 'DUPLICATE' })
    await simulateReviewedPublish(db, 'brand_snapshots', candidate.id)
    assert.deepEqual(await saveSnapshotDraft(rpc(db), { ...candidate, id: id(922) }), { ok: false, code: 'REVISION_REQUIRED' })
    const next = (await snapshotCandidate(db, pattern.id, take.id)).candidate
    assert.deepEqual([next.existing.decision, next.existing.revision], ['REVISION_CANDIDATE', 2])
    assert.equal((await saveSnapshotDraft(rpc(db), next)).ok, true)
    assert.deepEqual((await db.query('SELECT status,revision FROM brand_snapshots ORDER BY revision')).rows.map(r => [r.status, r.revision]), [['published', 1], ['draft', 2]])
    await assert.rejects(db.query("UPDATE brand_snapshots SET watch_next='edited' WHERE id=$1", [candidate.id]), /immutable/)
  } finally { await db.close() }
})

test('E2E: Source -> Evidence -> Movement -> Pattern -> Take -> Snapshot, then an evidence correction is traced without rewriting history', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    const providers = []
    // Unrelated chain for isolation: another entity's reviewed pattern and take.
    const tossPattern = await patternCandidate(db, TOSS, [5, 6], 'toss'); providers.push(tossPattern.provider)
    assert.equal((await savePatternDraft(rpc(db), tossPattern.candidate)).ok, true); await simulateReviewedPublish(db, 'brand_patterns', tossPattern.candidate.id)
    const tossTake = await takeCandidate(db, TOSS, tossPattern.candidate.id, [5, 6]); providers.push(tossTake.provider)
    assert.equal((await saveTakeDraft(rpc(db), tossTake.candidate)).ok, true); await simulateReviewedPublish(db, 'brand_takes', tossTake.candidate.id)
    // Brand chain.
    const pattern = await patternCandidate(db, MUSINSA, [1, 2, 3]); providers.push(pattern.provider)
    assert.equal(pattern.candidate.reviewStatus, 'needs_review')
    assert.equal((await savePatternDraft(rpc(db), pattern.candidate)).ok, true); await simulateReviewedPublish(db, 'brand_patterns', pattern.candidate.id)
    const take = await takeCandidate(db, MUSINSA, pattern.candidate.id, [1, 2, 3]); providers.push(take.provider)
    assert.equal((await saveTakeDraft(rpc(db), take.candidate)).ok, true); await simulateReviewedPublish(db, 'brand_takes', take.candidate.id)
    const snapshot = await snapshotCandidate(db, pattern.candidate.id, take.candidate.id); providers.push(snapshot.provider)
    assert.deepEqual([take.candidate.reviewState, snapshot.candidate.reviewState], ['needs_review', 'needs_review'])
    assert.equal((await saveSnapshotDraft(rpc(db), snapshot.candidate)).ok, true); await simulateReviewedPublish(db, 'brand_snapshots', snapshot.candidate.id)

    const healthy = evaluateLineageHealth(await loadGraph(db), generatedAt)
    assert.deepEqual(healthy.summary, { HEALTHY: 11, STALE: 0, REVIEW_REQUIRED: 0, BROKEN: 0 })
    const counts = async () => (await one(db, "SELECT (SELECT count(*) FROM brand_evidence)::int e,(SELECT count(*) FROM brand_movements)::int m,(SELECT count(*) FROM brand_patterns)::int p,(SELECT count(*) FROM brand_takes)::int t,(SELECT count(*) FROM brand_snapshots)::int s,(SELECT count(*) FROM movement_evidence)::int me,(SELECT count(*) FROM take_evidence)::int te,(SELECT count(*) FROM snapshot_takes)::int st"))
    const before = { ...(await counts()) }, calls = providers.map(row => row.calls)

    // Correction: a reviewer supersedes the festival evidence through the 4A command.
    const corrected = await review(db, { command: 'evidence.supersede', evidenceId: id(11), successor: { sourceItemId: null, fact: 'Corrected festival fact', supportText: 'Corrected support span', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.6 } })
    assert.equal(corrected.ok, true)
    const report = evaluateLineageHealth(await loadGraph(db), generatedAt)
    const row = (kind, rowId) => report.results.find(r => r.kind === kind && r.id === rowId)
    assert.deepEqual([row('movement', id(1)).health, row('movement', id(1)).action], ['REVIEW_REQUIRED', 'HUMAN_REVIEW'])
    for (const [kind, rowId] of [['pattern', pattern.candidate.id], ['take', take.candidate.id], ['snapshot', snapshot.candidate.id]]) assert.deepEqual([row(kind, rowId).health, row(kind, rowId).action], ['STALE', 'REGENERATION_CANDIDATE'], kind)
    assert.deepEqual(correctionImpact(report, `evidence:${id(11)}`).map(r => r.id), [id(1), pattern.candidate.id, take.candidate.id, snapshot.candidate.id])
    for (const rowId of [id(2), id(3), id(4), id(5), id(6)]) assert.equal(row('movement', rowId).health, 'HEALTHY')
    assert.deepEqual([row('pattern', tossPattern.candidate.id).health, row('take', tossTake.candidate.id).health], ['HEALTHY', 'HEALTHY'])
    assert.deepEqual(report.summary, { HEALTHY: 7, STALE: 3, REVIEW_REQUIRED: 1, BROKEN: 0 })
    // History preserved: nothing deleted, nothing unpublished, no model call, only the successor evidence was added.
    assert.deepEqual({ ...(await counts()) }, { ...before, e: before.e + 1 })
    assert.deepEqual((await db.query('SELECT status FROM brand_patterns UNION ALL SELECT status FROM brand_takes UNION ALL SELECT status FROM brand_snapshots')).rows.map(r => r.status), Array(5).fill('published'))
    assert.deepEqual({ ...(await one(db, 'SELECT status,review_status FROM brand_evidence WHERE id=$1', [id(11)])) }, { status: 'superseded', review_status: 'approved' })
    assert.deepEqual(providers.map(row => row.calls), calls)
    assert.deepEqual((await db.query("SELECT action FROM brand_watch_review_events WHERE target_id=$1 ORDER BY occurred_at,action", [id(11)])).rows.map(r => r.action), ['approve', 'supersede'])
  } finally { await db.close() }
})
