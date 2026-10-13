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
const { patternPolicySchema } = load(root + 'patterns/schemas.ts')
const { snapshotAIOutputSchema, snapshotEngineInputSchema } = load(root + 'snapshots/schemas.ts')
const { assessSnapshotEligibility } = load(root + 'snapshots/eligibility.ts')
const { generateSnapshotCandidate, classifyExistingSnapshot } = load(root + 'snapshots/generate.ts')
const { prepareSnapshotDraft } = load(root + 'snapshots/storage.ts')
const snapshotModules = ['schemas', 'eligibility', 'prompts', 'generate', 'storage'].map(name => load(root + `snapshots/${name}.ts`))

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z', policy = patternPolicySchema.parse({})
const confidence = { score: 0.9, basis: 'One reviewed pattern and take over three distinct approved movements.' }
function evidence(n, entityId = MUSINSA, changes = {}) {
  return { id: id(n), entityId, sourceItemId: id(100 + n), fact: `Reviewed beauty fact ${'abcdefghij'[n % 10]}`, eventDate: null, reviewStatus: 'approved', status: 'active', marketingRelevance: 1, matchRole: 'primary', matchReviewStatus: 'approved',
    source: { providerId: id(200 + n), providerType: 'industry_media', canonicalUrl: `https://p${n}.example.test/story`, contentHash: String(n % 10).repeat(64), publishedAt: null }, ...changes }
}
function movement(n, title, type, day, evidenceRows, changes = {}) {
  return { id: id(n), entityId: evidenceRows[0]?.entityId ?? MUSINSA, eventKey: `event-${n}`, title, summary: title, movementType: type, status: 'published', mergedIntoId: null, startedAt: null, lastObservedAt: `${day}T09:00:00Z`, evidence: evidenceRows.map(row => ({ ...row, eventDate: day })), ...changes }
}
const movements = () => [
  movement(1, 'MUSINSA Beauty Festa', 'campaign', '2026-09-01', [evidence(11)]),
  movement(2, 'Beauty specialty store expansion', 'platform', '2026-09-15', [evidence(12)]),
  movement(3, 'Beauty creator campaign', 'creator', '2026-10-01', [evidence(13)]),
  movement(4, 'Toss card promotion', 'promotion', '2026-09-05', [evidence(14, TOSS)]),
  movement(5, 'Toss creator series', 'creator', '2026-09-25', [evidence(15, TOSS)]),
  movement(6, 'Unreviewed beauty pop-up', 'campaign', '2026-09-20', [evidence(16, MUSINSA, { reviewStatus: 'pending' })]),
  movement(7, 'Merged duplicate festa report', 'campaign', '2026-09-02', [evidence(17)], { status: 'superseded', mergedIntoId: id(1) }),
]
const patternRow = (n, movementIds, changes = {}) => ({ id: id(n), entityId: MUSINSA, title: 'Recurring beauty-related marketing activity', description: 'Beauty-related marketing activity recurred across a festival, a store expansion and a creator campaign.', windowStart: '2026-09-01', windowEnd: '2026-10-01', status: 'published', revision: 1, movementIds, ...changes })
const takeRow = (n, patternId, evidenceIds, changes = {}) => ({ id: id(n), entityId: MUSINSA, patternId, status: 'published', revision: 1, whatWeSee: 'MUSINSA ran a beauty festival, expanded a beauty store and ran a beauty creator campaign.', whyItMayMatter: '이는 뷰티 영역에서 브랜드 접점을 넓히려는 움직임일 수 있다.', whatToWatchNext: 'Watch whether further beauty campaigns or store expansions follow.', evidenceIds, ...changes })
const P = () => patternRow(50, [id(1), id(2), id(3)]), T = () => takeRow(60, id(50), [id(11), id(12), id(13)])
const snapshot = (changes = {}) => ({ headline: 'MUSINSA: recurring beauty-focused marketing', currentDirection: 'Reviewed movements show beauty-related marketing recurring across a festival, a store expansion and a creator campaign; MarkLens reads this as a possible widening of beauty touchpoints.', watchNext: 'Watch whether further beauty campaigns or store expansions follow.', keyMovementIds: [id(1), id(2), id(3)], keyPatternIds: [id(50)], keyTakeIds: [id(60)], uncertainties: ['Single pattern.'], confidence, ...changes })
const output = value => ({ snapshot: value === undefined ? snapshot() : value, noSnapshotReason: value === null ? 'Nothing to synthesize.' : null })
function transport(value = output()) {
  const provider = { provider: 'mock-gemini', model: 'fixture-model-v1', calls: [], async generate(request) { provider.calls.push(request); return { kind: 'text', text: JSON.stringify(value) } } }
  return provider
}
async function run({ patterns = [P()], takes = [T()], rows = movements(), existingSnapshots = [], value = output(), at = generatedAt } = {}) {
  const provider = transport(value)
  const result = await generateSnapshotCandidate({ entityId: MUSINSA, movements: rows, patterns, takes, existingSnapshots }, [provider], at)
  return { result, provider }
}

test('A/10-13: movement + pattern + take yields a needs_review snapshot with lineage-derived counts and time', async () => {
  const { result, provider } = await run()
  assert.equal(result.status, 'SNAPSHOT_CANDIDATE'); assert.equal(provider.calls.length, 1)
  const c = result.candidate
  assert.equal(c.reviewState, 'needs_review'); assert.equal(c.confidence.score, 0.75)
  assert.deepEqual([c.keyMovementIds, c.keyPatternIds, c.keyTakeIds], [[id(1), id(2), id(3)], [id(50)], [id(60)]])
  assert.deepEqual(c.lineage, { movementIds: [id(1), id(2), id(3)], evidenceIds: [id(11), id(12), id(13)], sourceItemIds: [id(111), id(112), id(113)] })
  assert.deepEqual([c.movementCount, c.sourceCount, c.sourceItemCount, c.patternCount, c.takeCount], [3, 3, 3, 1, 1])
  assert.deepEqual(c.storedCoverage, { evidenceCount: 3, sourceCount: 3 })
  assert.deepEqual([c.asOf, c.coverageWindowStart, c.coverageWindowEnd], ['2026-10-01T09:00:00Z', '2026-09-01', '2026-10-01'])
  assert.deepEqual(c.publishReadiness.blockers, ['HUMAN_REVIEW_REQUIRED'])
  assert.deepEqual(c.provenance, { provider: 'mock-gemini', model: 'fixture-model-v1', promptVersion: 'snapshot-v1', pipelineVersion: 'snapshot-engine-v1', generatedAt })
  assert.deepEqual(c.existing, { decision: 'NEW', matchedSnapshotId: null, revision: 1 })
  // Deterministic: clock and model confidence do not change counts, asOf or coverage.
  const again = (await run({ at: '2026-10-20T00:00:00Z', value: output(snapshot({ confidence: { score: 0.3, basis: 'Lower.' } })) })).result.candidate
  for (const key of ['asOf', 'coverageWindowStart', 'coverageWindowEnd', 'movementCount', 'sourceCount', 'patternCount', 'takeCount', 'storedCoverage', 'lineage']) assert.deepEqual(again[key], c[key], key)
})

test('snapshot-v1 request sends reviewed summaries and minimal metadata only, with eligible IDs as trusted context', async () => {
  const { provider } = await run({ patterns: [P(), patternRow(52, [id(1), id(2)], { status: 'draft', title: 'Draft-only secret pattern' })] })
  const request = provider.calls[0], data = JSON.parse(request.sourceData)
  assert.match(request.system, /CURRENT SYNTHESIS/); assert.match(request.system, /Do not output dates or counts/)
  assert.deepEqual([request.trustedContext.allowedPatternIds, request.trustedContext.allowedTakeIds, request.trustedContext.allowedMovementIds], [[id(50)], [id(60)], [id(1), id(2), id(3)]])
  assert.equal(request.trustedContext.promptVersion, 'snapshot-v1')
  assert.ok(!request.sourceData.includes('Draft-only secret pattern')); assert.ok(!request.sourceData.includes('Toss card promotion'))
  assert.deepEqual(Object.keys(data.movements[0].evidence[0]).sort(), ['fact', 'id', 'providerType'])
  assert.equal(request.responseSchema.additionalProperties, false)
})

test('1-4: only same-entity, reviewed, unsuperseded data with intact lineage is eligible', () => {
  const patterns = [P(), patternRow(51, [id(1), id(2)], { status: 'superseded' }), patternRow(52, [id(1), id(2)], { status: 'draft' }), patternRow(53, [id(4), id(5)], { entityId: TOSS }), patternRow(55, [id(1), id(6)]), patternRow(57, [id(1), id(2)], { windowStart: '2026-01-01', windowEnd: '2026-02-01' })]
  const takes = [T(), takeRow(61, id(50), [id(11)], { status: 'superseded' }), takeRow(62, id(50), [id(11)], { status: 'draft' }), takeRow(63, id(53), [id(14)], { entityId: TOSS }), takeRow(64, id(50), [id(11), id(14)]), takeRow(65, id(52), [id(11)])]
  const gate = assessSnapshotEligibility(MUSINSA, { movements: movements(), patterns, takes }, generatedAt, policy)
  assert.deepEqual([gate.movements.map(row => row.movement.id), gate.patterns.map(row => row.pattern.id), gate.takes.map(row => row.take.id)], [[id(1), id(2), id(3)], [id(50)], [id(60)]])
  const reason = (kind, key, n) => gate.excluded[kind].find(row => row[key] === id(n)).reasons
  assert.ok(reason('movements', 'movementId', 4).includes('OTHER_ENTITY')); assert.ok(reason('movements', 'movementId', 6).includes('BROKEN_EVIDENCE_LINEAGE')); assert.ok(reason('movements', 'movementId', 7).includes('SUPERSEDED'))
  assert.ok(reason('patterns', 'patternId', 51).includes('SUPERSEDED')); assert.ok(reason('patterns', 'patternId', 53).includes('OTHER_ENTITY')); assert.ok(reason('patterns', 'patternId', 55).includes('BROKEN_MOVEMENT_LINEAGE'))
  assert.deepEqual(reason('patterns', 'patternId', 57), ['OUTSIDE_RECENCY_WINDOW'])
  assert.ok(reason('takes', 'takeId', 61).includes('SUPERSEDED')); assert.ok(reason('takes', 'takeId', 62).includes('NOT_REVIEWED')); assert.ok(reason('takes', 'takeId', 63).includes('OTHER_ENTITY'))
  assert.deepEqual(reason('takes', 'takeId', 64), ['BROKEN_EVIDENCE_LINEAGE']); assert.deepEqual(reason('takes', 'takeId', 65), ['PATTERN_NOT_ELIGIBLE'])
})

test('no eligible pattern means no snapshot and no AI call; a pattern without takes is a candidate that cannot publish', async () => {
  for (const patterns of [[], [patternRow(52, [id(1), id(2)], { status: 'draft' })]]) {
    const { result, provider } = await run({ patterns, takes: [] })
    assert.deepEqual([result.status, result.candidate, provider.calls.length], ['NO_ELIGIBLE_PATTERN', null, 0])
  }
  const { result } = await run({ takes: [], value: output(snapshot({ keyTakeIds: [] })) })
  assert.equal(result.candidate.takeCount, 0); assert.deepEqual(result.candidate.storedCoverage, { evidenceCount: 0, sourceCount: 0 })
  assert.deepEqual(result.candidate.publishReadiness.blockers, ['NO_REVIEWED_TAKE', 'HUMAN_REVIEW_REQUIRED'])
  assert.deepEqual(prepareSnapshotDraft(result.candidate).links, [])
  assert.equal((await run({ value: output(null) })).result.status, 'NO_SNAPSHOT')
})

test('B/C: broken-lineage and other-entity items are excluded and cannot be cited', async () => {
  const takes = [T(), takeRow(64, id(50), [id(11), id(14)])], patterns = [P(), patternRow(53, [id(4), id(5)], { entityId: TOSS })]
  const issues = async value => (await run({ patterns, takes, value: output(snapshot(value)) })).result
  for (const [value, code] of [[{ keyTakeIds: [id(64)] }, 'INELIGIBLE_TAKE_ID'], [{ keyPatternIds: [id(50), id(53)] }, 'INELIGIBLE_PATTERN_ID'], [{ keyMovementIds: [id(1), id(4)] }, 'INELIGIBLE_MOVEMENT_ID'], [{ keyMovementIds: [id(6)] }, 'INELIGIBLE_MOVEMENT_ID']]) {
    const result = await issues(value)
    assert.deepEqual([result.status, result.candidate], ['REJECTED', null]); assert.ok(result.issues.includes(code), code)
  }
})

test('D/7-9: hallucinated movement, pattern or take IDs and uncited take patterns are rejected', async () => {
  for (const [value, code] of [[{ keyMovementIds: [id(1), id(999)] }, 'HALLUCINATED_MOVEMENT_ID'], [{ keyPatternIds: [id(998)] }, 'HALLUCINATED_PATTERN_ID'], [{ keyTakeIds: [id(997)] }, 'HALLUCINATED_TAKE_ID']]) {
    const { result } = await run({ value: output(snapshot(value)) })
    assert.equal(result.status, 'REJECTED'); assert.ok(result.issues.includes(code), code)
  }
  const { result } = await run({ patterns: [P(), patternRow(56, [id(1), id(2)])], value: output(snapshot({ keyPatternIds: [id(56)] })) })
  assert.deepEqual(result.issues, ['TAKE_PATTERN_NOT_CITED'])
})

test('5/6: strict schema rejects unknown fields, model-supplied dates/counts and missing sections', async () => {
  assert.ok(snapshotAIOutputSchema.safeParse(output()).success)
  const { headline, ...noHeadline } = snapshot()
  for (const value of [output({ ...snapshot(), asOf: '2026-10-13T00:00:00Z' }), output({ ...snapshot(), sourceCount: 9 }), { ...output(), publish: true }, output(noHeadline), output(snapshot({ keyPatternIds: [] })), output(snapshot({ watchNext: ' ' }))]) {
    const { result } = await run({ value })
    assert.deepEqual([result.status, result.error, result.candidate], ['AI_FAILURE', 'SCHEMA_FAILURE', null])
  }
  assert.ok(headline)
  assert.ok(!snapshotEngineInputSchema.safeParse({ entityId: MUSINSA, movements: [], patterns: [], takes: [{ ...T(), approved: true }], existingSnapshots: [] }).success)
})

test('G/17/18: unsupported numbers, targets, market share, revenue and certainty are rejected', async () => {
  const cases = [
    [{ currentDirection: 'MUSINSA aims to reach a 30% beauty market share by 2027.' }, ['UNSUPPORTED_NUMBER', 'UNSUPPORTED_STRATEGIC_CERTAINTY', 'UNSUPPORTED_MARKET_CLAIM']],
    [{ headline: 'MUSINSA will lead beauty' }, ['UNSUPPORTED_FUTURE_CERTAINTY']],
    [{ currentDirection: 'Beauty activity is lifting MUSINSA sales.' }, ['UNSUPPORTED_BUSINESS_OUTCOME']],
    [{ watchNext: 'Watch how 올리브영 responds.' }, ['UNSUPPORTED_COMPETITOR_CLAIM']],
  ]
  for (const [value, expected] of cases) {
    const { result } = await run({ value: output(snapshot(value)) })
    assert.equal(result.status, 'REJECTED'); assert.deepEqual(result.issues, expected)
  }
})

test('E/F/15/16: published predecessor gets a successor revision; drafts or ambiguity need review', async () => {
  const row = (n, status, revision = 1, entityId = MUSINSA) => ({ id: id(n), entityId, status, revision })
  assert.deepEqual(classifyExistingSnapshot(MUSINSA, [row(70, 'published', 3), row(69, 'superseded', 2)]), { decision: 'REVISION_CANDIDATE', matchedSnapshotId: id(70), revision: 4 })
  assert.equal(classifyExistingSnapshot(MUSINSA, [row(70, 'draft')]).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyExistingSnapshot(MUSINSA, [row(70, 'published'), row(71, 'published')]).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyExistingSnapshot(MUSINSA, [row(70, 'published', 1, TOSS), row(71, 'withdrawn')]).decision, 'NEW')
  const { result } = await run({ existingSnapshots: [row(70, 'draft')] })
  assert.equal(result.candidate.existing.decision, 'POSSIBLE_DUPLICATE')
  assert.throws(() => prepareSnapshotDraft(result.candidate), /DUPLICATE_REVIEW_REQUIRED/)
})

test('13/14: prepared storage is an unreviewed draft and the engine exposes no approve/publish path', async () => {
  const { result } = await run()
  const plan = prepareSnapshotDraft(result.candidate)
  assert.deepEqual([plan.snapshot.status, plan.snapshot.reviewed_by, plan.snapshot.reviewed_at, plan.snapshot.revision, plan.snapshot.supersedes_id], ['draft', null, null, 1, null])
  assert.deepEqual([plan.snapshot.body, plan.snapshot.watch_next], [result.candidate.currentDirection, result.candidate.watchNext])
  assert.deepEqual([plan.snapshot.valid_from, plan.snapshot.evidence_count, plan.snapshot.source_count], ['2026-10-01T09:00:00Z', 3, 3])
  assert.deepEqual(plan.links.map(row => row.take_id), [id(60)])
  assert.throws(() => prepareSnapshotDraft({ ...result.candidate, reviewState: 'approved' }))
  for (const exported of snapshotModules.flatMap(module => Object.keys(module))) assert.doesNotMatch(exported, /publish|approve/i)
})

test('actual 018 accepts the prepared snapshot counts and keeps the published predecessor on revision', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
    await db.exec(readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8'))
    for (const file of ['019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle']) await db.exec(readFileSync(`supabase/migrations/${file}.sql`, 'utf8'))
    const insert = async (table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
    const entity = launchRegistry.find(row => row.slug === 'musinsa').entity
    await insert('brand_entities', { id: entity.id, slug: entity.slug, name: entity.name, name_ko: entity.nameKo, entity_type: entity.entityType, category: entity.category })
    for (const row of movements().slice(0, 3)) {
      for (const ev of row.evidence) {
        await insert('source_providers', { id: ev.source.providerId, name: 'Synthetic', domain: new URL(ev.source.canonicalUrl).hostname, provider_type: ev.source.providerType, source_tier: 2, reliability_policy: 'Attribution only', ingestion_method: 'manual' })
        await insert('source_items', { id: ev.sourceItemId, provider_id: ev.source.providerId, canonical_url: ev.source.canonicalUrl, original_url: ev.source.canonicalUrl, title: 'Synthetic', date_precision: 'unknown', content_hash: ev.source.contentHash })
        await insert('source_entity_matches', { source_item_id: ev.sourceItemId, entity_id: entity.id, role: 'primary', confidence: 1, method: 'manual', review_status: 'approved' })
        await insert('brand_evidence', { id: ev.id, entity_id: entity.id, source_item_id: ev.sourceItemId, fact: ev.fact, support_text: 'Synthetic support', event_date: ev.eventDate, date_precision: 'day', marketing_relevance: 1, confidence: 1, extraction_method: 'manual', review_status: 'approved' })
      }
      await insert('brand_movements', { id: row.id, entity_id: entity.id, event_key: row.eventKey, title: row.title, summary: row.summary, movement_type: row.movementType, scope: 'national', importance: 1 })
      for (const ev of row.evidence) await insert('movement_evidence', { entity_id: entity.id, movement_id: row.id, evidence_id: ev.id })
      await db.query("UPDATE brand_movements SET status='published' WHERE id=$1", [row.id])
    }
    const p = P(), t = T()
    await insert('brand_patterns', { id: p.id, entity_id: entity.id, title: p.title, description: p.description, window_start: p.windowStart, window_end: p.windowEnd, confidence: 0.6 })
    for (const movementId of p.movementIds) await insert('pattern_movements', { entity_id: entity.id, pattern_id: p.id, movement_id: movementId })
    await db.query("UPDATE brand_patterns SET status='published' WHERE id=$1", [p.id])
    await insert('brand_takes', { id: t.id, entity_id: entity.id, pattern_id: p.id, what_we_see: t.whatWeSee, why_it_may_matter: t.whyItMayMatter, what_to_watch_next: t.whatToWatchNext })
    for (const evidenceId of t.evidenceIds) await insert('take_evidence', { entity_id: entity.id, take_id: t.id, evidence_id: evidenceId })
    await db.query("UPDATE brand_takes SET status='published' WHERE id=$1", [t.id])

    const plan = prepareSnapshotDraft((await run()).result.candidate)
    await db.exec('BEGIN'); await insert('brand_snapshots', plan.snapshot); for (const link of plan.links) await insert('snapshot_takes', link); await db.exec('COMMIT')
    // The engine-computed stored counts satisfy 018's lineage check once a reviewer signs; discarded here.
    await db.exec('BEGIN'); await db.exec('SET CONSTRAINTS ALL IMMEDIATE')
    await db.query("UPDATE brand_snapshots SET reviewed_by='reviewer', reviewed_at=now(), status='published' WHERE id=$1", [plan.snapshot.id]); await db.exec('ROLLBACK')
    assert.deepEqual({ ...(await db.query('SELECT status,reviewed_by FROM brand_snapshots WHERE id=$1', [plan.snapshot.id])).rows[0] }, { status: 'draft', reviewed_by: null })
    await db.exec('BEGIN'); await db.exec('SET CONSTRAINTS ALL IMMEDIATE')
    await assert.rejects(db.query("UPDATE brand_snapshots SET reviewed_by='reviewer', reviewed_at=now(), source_count=9, status='published' WHERE id=$1", [plan.snapshot.id]), /coverage counts/); await db.exec('ROLLBACK')

    // Simulated human review publishes the first; the next candidate is a successor that never touches it.
    await db.query("UPDATE brand_snapshots SET reviewed_by='reviewer', reviewed_at=now(), status='published' WHERE id=$1", [plan.snapshot.id])
    const existingSnapshots = [{ id: plan.snapshot.id, entityId: entity.id, status: 'published', revision: 1 }]
    const successor = prepareSnapshotDraft((await run({ existingSnapshots })).result.candidate)
    assert.deepEqual([successor.snapshot.supersedes_id, successor.snapshot.revision], [plan.snapshot.id, 2])
    await db.exec('BEGIN'); await insert('brand_snapshots', successor.snapshot); for (const link of successor.links) await insert('snapshot_takes', link); await db.exec('COMMIT')
    assert.deepEqual((await db.query('SELECT status,revision,headline FROM brand_snapshots ORDER BY revision')).rows.map(row => [row.status, row.revision]), [['published', 1], ['draft', 2]])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM snapshot_takes WHERE snapshot_id=$1', [plan.snapshot.id])).rows[0].n, 1)
    await assert.rejects(insert('brand_snapshots', prepareSnapshotDraft((await run({ existingSnapshots })).result.candidate).snapshot), /brand_snapshots_successor_idx|duplicate key/)
  } finally { await db.close() }
})
