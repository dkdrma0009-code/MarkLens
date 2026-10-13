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
const { takeAIOutputSchema, takeEngineInputSchema } = load(root + 'takes/schemas.ts')
const { assessTakeEligibility } = load(root + 'takes/eligibility.ts')
const { validateTakeClaims } = load(root + 'takes/claims.ts')
const { generateTakeCandidates, classifyExistingTake } = load(root + 'takes/generate.ts')
const { prepareTakeDraft } = load(root + 'takes/storage.ts')
const takeModules = ['schemas', 'eligibility', 'claims', 'prompts', 'generate', 'storage'].map(name => load(root + `takes/${name}.ts`))

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z', policy = patternPolicySchema.parse({})
const confidence = { score: 0.9, basis: 'One reviewed pattern of three distinct approved movements.' }
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
]
const patternRow = (n, movementIds, changes = {}) => ({ id: id(n), entityId: MUSINSA, title: 'Recurring beauty-related marketing activity', description: 'Beauty-related marketing activity recurred across a festival, a store expansion and a creator campaign.', windowStart: '2026-09-01', windowEnd: '2026-10-01', status: 'published', revision: 1, movementIds, ...changes })
const P = () => patternRow(50, [id(1), id(2), id(3)])
const take = (changes = {}) => ({ patternIds: [id(50)], movementIds: [id(1), id(2), id(3)], evidenceIds: [id(11), id(12), id(13)],
  whatWeSee: 'Between 2026-09-01 and 2026-10-01 MUSINSA ran a beauty festival, expanded a beauty specialty store and ran a beauty creator campaign.',
  whyItMayMatter: '이는 뷰티 영역에서 브랜드 접점을 넓히려는 움직임일 수 있다.',
  whatToWatchNext: 'Watch whether further beauty campaigns or store expansions follow, and whether they will stay beauty-focused.',
  uncertainties: ['Short window.'], confidence, ...changes })
const output = (takes = [take()]) => ({ takes, noTakeReason: takes.length ? null : 'No take.' })
function transport(value = output()) {
  const provider = { provider: 'mock-gemini', model: 'fixture-model-v1', calls: [], async generate(request) { provider.calls.push(request); return { kind: 'text', text: JSON.stringify(value) } } }
  return provider
}
async function run(patterns = [P()], value = output(), existingTakes = [], rows = movements()) {
  const provider = transport(value)
  const result = await generateTakeCandidates({ entityId: MUSINSA, patterns, movements: rows, existingTakes }, [provider], generatedAt)
  return { result, provider }
}

test('A/16/17: a reviewed pattern yields a needs_review take with three sections and full lineage', async () => {
  const { result, provider } = await run()
  assert.equal(result.status, 'TAKE_CANDIDATES'); assert.equal(provider.calls.length, 1); assert.deepEqual(result.rejected, [])
  const [candidate] = result.candidates
  assert.equal(candidate.reviewState, 'needs_review'); assert.equal(candidate.confidence.score, 0.75)
  assert.deepEqual([candidate.patternIds, candidate.movementIds, candidate.evidenceIds, candidate.sourceItemIds], [[id(50)], [id(1), id(2), id(3)], [id(11), id(12), id(13)], [id(111), id(112), id(113)]])
  assert.match(candidate.whyItMayMatter, /수 있다/)
  assert.deepEqual(candidate.provenance, { provider: 'mock-gemini', model: 'fixture-model-v1', promptVersion: 'take-v1', pipelineVersion: 'take-engine-v1', generatedAt })
  assert.deepEqual(candidate.existing, { decision: 'NEW', matchedTakeId: null, revision: 1 })
})

test('take-v1 request sends reviewed lineage and metadata only, with eligible patterns as trusted context', async () => {
  const { provider } = await run([P(), patternRow(52, [id(1), id(6)], { status: 'draft', title: 'Draft-only secret pattern' })])
  const request = provider.calls[0], data = JSON.parse(request.sourceData)
  assert.match(request.system, /interpretation, not fact/); assert.match(request.system, /whyItMayMatter/)
  assert.deepEqual(request.trustedContext.allowedPatternIds, [id(50)]); assert.equal(request.trustedContext.promptVersion, 'take-v1')
  assert.equal(data.type, 'TAKE_DATA'); assert.ok(!request.sourceData.includes('Draft-only secret pattern'))
  assert.deepEqual(Object.keys(data.patterns[0].movements[0].evidence[0]).sort(), ['eventDate', 'fact', 'id', 'providerType', 'publishedAt'])
  assert.equal(request.responseSchema.additionalProperties, false)
})

test('1-3: only published, same-entity patterns with intact movement/evidence/source lineage are eligible', () => {
  const cases = [
    [patternRow(51, [id(1), id(2)], { status: 'superseded' }), 'SUPERSEDED'],
    [patternRow(52, [id(1), id(2)], { status: 'draft' }), 'NOT_REVIEWED'],
    [patternRow(53, [id(4), id(5)], { entityId: TOSS }), 'OTHER_ENTITY'],
    [patternRow(54, [id(1), id(99)]), 'MISSING_MOVEMENT'],
    [patternRow(55, [id(1), id(6)]), 'BROKEN_MOVEMENT_LINEAGE'],
    [patternRow(56, [id(1), id(4)]), 'BROKEN_MOVEMENT_LINEAGE'],
    [patternRow(57, [id(1), id(2)], { status: 'withdrawn' }), 'WITHDRAWN'],
  ]
  const rows = [...movements(), movement(7, 'MUSINSA Beauty Festa', 'campaign', '2026-09-02', [evidence(17)])]
  const gate = assessTakeEligibility(MUSINSA, [P(), ...cases.map(([row]) => row), patternRow(58, [id(1), id(7)])], rows, generatedAt, policy)
  assert.deepEqual(gate.eligible.map(row => row.pattern.id), [id(50)])
  for (const [row, reason] of cases) assert.ok(gate.excluded.find(entry => entry.patternId === row.id).reasons.includes(reason), reason)
  assert.deepEqual(gate.excluded.find(entry => entry.patternId === id(58)).reasons, ['INSUFFICIENT_INDEPENDENT_MOVEMENTS'])
  // A reviewed pattern is not re-gated on recency here (freshness is 4D).
  const old = [movement(1, 'Old festa', 'campaign', '2025-01-01', [evidence(11)]), movement(2, 'Old store', 'platform', '2025-02-01', [evidence(12)])]
  assert.equal(assessTakeEligibility(MUSINSA, [patternRow(50, [id(1), id(2)])], old, generatedAt, policy).eligible.length, 1)
})

test('B/4: no eligible pattern means no take and no AI call', async () => {
  for (const patterns of [[], [patternRow(52, [id(1), id(2)], { status: 'draft' })], [patternRow(51, [id(1), id(2)], { status: 'superseded' })]]) {
    const { result, provider } = await run(patterns)
    assert.equal(result.status, 'NO_ELIGIBLE_PATTERN'); assert.equal(provider.calls.length, 0); assert.deepEqual(result.candidates, [])
  }
})

test('C: another entity\'s pattern is excluded and cannot be cited', async () => {
  const { result } = await run([P(), patternRow(53, [id(4), id(5)], { entityId: TOSS })], output([take({ patternIds: [id(53)], movementIds: [id(4)], evidenceIds: [id(14)] }), take()]))
  assert.ok(result.excluded.find(row => row.patternId === id(53)).reasons.includes('OTHER_ENTITY'))
  assert.deepEqual(result.rejected[0].issues.slice(0, 2), ['INELIGIBLE_PATTERN_ID', 'MOVEMENT_OUTSIDE_PATTERN_LINEAGE'])
  assert.equal(result.candidates.length, 1); assert.deepEqual(result.candidates[0].patternIds, [id(50)])
})

test('D/E/7-10: hallucinated IDs and evidence outside the cited lineage are rejected per take', async () => {
  const issues = async value => (await run([P()], output([value]))).result.rejected[0]?.issues ?? []
  assert.ok((await issues(take({ patternIds: [id(999)] }))).includes('HALLUCINATED_PATTERN_ID'))
  assert.ok((await issues(take({ movementIds: [id(1), id(998)] }))).includes('HALLUCINATED_MOVEMENT_ID'))
  assert.ok((await issues(take({ movementIds: [id(1), id(4)] }))).includes('MOVEMENT_OUTSIDE_PATTERN_LINEAGE'))
  assert.deepEqual(await issues(take({ evidenceIds: [id(11), id(997)] })), ['HALLUCINATED_EVIDENCE_ID'])
  assert.deepEqual(await issues(take({ evidenceIds: [id(11), id(14)] })), ['EVIDENCE_OUTSIDE_PATTERN_LINEAGE'])
  assert.deepEqual(await issues(take({ movementIds: [id(1)], evidenceIds: [id(11), id(12)] })), ['EVIDENCE_OUTSIDE_CITED_MOVEMENTS'])
})

test('5/6/11-13: strict schema requires all three sections and rejects unknown fields or multi-pattern takes', async () => {
  assert.ok(takeAIOutputSchema.safeParse(output()).success)
  const { whatWeSee, whyItMayMatter, whatToWatchNext, ...rest } = take()
  for (const value of [output([{ ...rest, whyItMayMatter, whatToWatchNext }]), output([{ ...rest, whatWeSee, whatToWatchNext }]), output([{ ...rest, whatWeSee, whyItMayMatter }]), output([take({ whatWeSee: '   ' })]),
    output([{ ...take(), approved: true }]), { ...output(), publish: true }, output([take({ patternIds: [id(50), id(51)] })])]) {
    const { result } = await run([P()], value)
    assert.deepEqual([result.status, result.error, result.candidates.length], ['AI_FAILURE', 'SCHEMA_FAILURE', 0])
  }
  assert.ok(!takeEngineInputSchema.safeParse({ entityId: MUSINSA, patterns: [{ ...P(), approved: true }], movements: [], existingTakes: [] }).success)
})

test('F/14/15: unsupported numbers, targets, certainty, outcomes and competitors are rejected', async () => {
  const corpus = ['Beauty creator campaign', '2026-09-01', '2026-10-01', 'Reviewed beauty fact b']
  const check = fields => validateTakeClaims({ ...take(), ...fields }, corpus, MUSINSA)
  assert.deepEqual(check({ whyItMayMatter: '무신사는 2027년까지 뷰티 시장 1위를 목표로 하고 있다.' }), ['UNSUPPORTED_NUMBER', 'UNSUPPORTED_STRATEGIC_CERTAINTY', 'UNSUPPORTED_MARKET_CLAIM', 'UNHEDGED_INTERPRETATION'])
  assert.ok(check({ whatWeSee: 'MUSINSA ran 12 beauty events.' }).includes('UNSUPPORTED_NUMBER'))
  assert.ok(check({ whyItMayMatter: 'MUSINSA intends to dominate beauty, which may matter.' }).includes('UNSUPPORTED_STRATEGIC_CERTAINTY'))
  assert.ok(check({ whyItMayMatter: '소비자들은 무신사에서 뷰티를 원한다.' }).includes('UNSUPPORTED_CONSUMER_CERTAINTY'))
  assert.deepEqual(check({ whyItMayMatter: 'This could lift sales.' }), ['UNSUPPORTED_BUSINESS_OUTCOME'])
  assert.ok(check({ whatToWatchNext: 'Beauty will become the main category.' }).includes('UNSUPPORTED_FUTURE_CERTAINTY'))
  assert.deepEqual(check({ whyItMayMatter: 'This may pressure 올리브영 in beauty retail.' }), ['UNSUPPORTED_COMPETITOR_CLAIM'])
  assert.deepEqual(check({ whyItMayMatter: 'Rivals could respond.' }), ['UNSUPPORTED_COMPETITOR_CLAIM'])
  assert.deepEqual(check({ whyItMayMatter: 'This expands beauty touchpoints.' }), ['UNHEDGED_INTERPRETATION'])
  const { result } = await run([P()], output([take({ whyItMayMatter: '무신사는 2027년까지 뷰티 시장 1위를 목표로 하고 있다.' })]))
  assert.equal(result.status, 'NO_TAKE'); assert.ok(result.rejected[0].issues.includes('UNSUPPORTED_NUMBER'))
})

test('G/16: reasonable hedged interpretation and input-backed specifics are allowed', async () => {
  const corpus = ['Beauty creator campaign', '2026-09-01', '2026-10-01']
  for (const whyItMayMatter of ['이는 뷰티 영역에서 브랜드 접점을 넓히려는 움직임일 수 있다.', 'This could indicate MUSINSA is broadening its beauty touchpoints.', 'The repeated beauty activity may suggest a growing emphasis worth tracking.'])
    assert.deepEqual(validateTakeClaims({ ...take(), whyItMayMatter }, corpus, MUSINSA), [])
  assert.deepEqual(validateTakeClaims({ ...take(), whatWeSee: 'Activity ran from 2026-09-01 to 2026-10-01.' }, corpus, MUSINSA), [])
  assert.deepEqual(validateTakeClaims({ ...take(), whyItMayMatter: 'The reported sales event may matter for beauty traffic.' }, [...corpus, 'MUSINSA held a beauty sales event'], MUSINSA), [])
})

test('existing takes: reviewed take gets a successor revision; drafts or ambiguity need duplicate review', () => {
  const row = (n, status, revision = 1, patternId = id(50)) => ({ id: id(n), entityId: MUSINSA, patternId, status, revision })
  assert.deepEqual(classifyExistingTake(MUSINSA, id(50), [row(60, 'published', 2)]), { decision: 'REVISION_CANDIDATE', matchedTakeId: id(60), revision: 3 })
  assert.equal(classifyExistingTake(MUSINSA, id(50), [row(60, 'draft')]).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyExistingTake(MUSINSA, id(50), [row(60, 'published'), row(61, 'draft', 1)]).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyExistingTake(MUSINSA, id(50), [row(60, 'superseded'), row(61, 'published', 1, id(51))]).decision, 'NEW')
})

test('17/18: prepared storage is draft only and the engine exposes no approve/publish path', async () => {
  const { result } = await run()
  const plan = prepareTakeDraft(result.candidates[0])
  assert.deepEqual([plan.take.status, plan.take.revision, plan.take.supersedes_id, plan.take.pattern_id], ['draft', 1, null, id(50)])
  assert.deepEqual(plan.links.map(row => row.evidence_id), [id(11), id(12), id(13)])
  assert.throws(() => prepareTakeDraft({ ...result.candidates[0], reviewState: 'approved' }))
  assert.throws(() => prepareTakeDraft({ ...result.candidates[0], existing: { decision: 'POSSIBLE_DUPLICATE', matchedTakeId: id(60), revision: 1 } }), /DUPLICATE_REVIEW_REQUIRED/)
  for (const exported of takeModules.flatMap(module => Object.keys(module))) assert.doesNotMatch(exported, /publish|approve/i)
})

test('actual 018 accepts the prepared take lineage as draft and a successor never touches the reviewed take', async () => {
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
    const p = P()
    await insert('brand_patterns', { id: p.id, entity_id: entity.id, title: p.title, description: p.description, window_start: p.windowStart, window_end: p.windowEnd, confidence: 0.6 })
    for (const movementId of p.movementIds) await insert('pattern_movements', { entity_id: entity.id, pattern_id: p.id, movement_id: movementId })
    await db.query("UPDATE brand_patterns SET status='published' WHERE id=$1", [p.id])

    const { result } = await run()
    const plan = prepareTakeDraft(result.candidates[0])
    await db.exec('BEGIN'); await insert('brand_takes', plan.take); for (const link of plan.links) await insert('take_evidence', link); await db.exec('COMMIT')
    assert.equal((await db.query('SELECT status FROM brand_takes WHERE id=$1', [plan.take.id])).rows[0].status, 'draft')
    // Prove the prepared lineage satisfies 018's reachability check, then discard: nothing is published here.
    await db.exec('BEGIN'); await db.exec('SET CONSTRAINTS ALL IMMEDIATE')
    await db.query("UPDATE brand_takes SET status='published' WHERE id=$1", [plan.take.id]); await db.exec('ROLLBACK')
    assert.equal((await db.query('SELECT status FROM brand_takes WHERE id=$1', [plan.take.id])).rows[0].status, 'draft')
    // A reviewed take gets a successor draft; the predecessor and its links are unchanged.
    await db.query("UPDATE brand_takes SET status='published' WHERE id=$1", [plan.take.id])
    const { result: next } = await run([P()], output(), [{ id: plan.take.id, entityId: entity.id, patternId: p.id, status: 'published', revision: 1 }])
    const successor = prepareTakeDraft(next.candidates[0])
    assert.deepEqual([successor.take.supersedes_id, successor.take.revision], [plan.take.id, 2])
    await db.exec('BEGIN'); await insert('brand_takes', successor.take); for (const link of successor.links) await insert('take_evidence', link); await db.exec('COMMIT')
    assert.deepEqual((await db.query('SELECT status,revision FROM brand_takes ORDER BY revision')).rows.map(row => [row.status, row.revision]), [['published', 1], ['draft', 2]])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM take_evidence WHERE take_id=$1', [plan.take.id])).rows[0].n, 3)
    const { result: again } = await run([P()], output(), [{ id: plan.take.id, entityId: entity.id, patternId: p.id, status: 'published', revision: 1 }])
    await assert.rejects(insert('brand_takes', prepareTakeDraft(again.candidates[0]).take), /brand_takes_successor_idx|duplicate key/)
  } finally { await db.close() }
})
