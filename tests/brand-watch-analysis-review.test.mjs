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
const { executeReviewCommand, reviewCommandSchema } = load(root + 'review/commands.ts')
const { evaluateLineageHealth, correctionImpact } = load(root + 'lifecycle/health.ts')
const { buildLineageGraph, loadLineageGraph } = load(root + 'lifecycle/load.ts')
const [m018, m019, m020, m021] = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle', '021_brand_watch_analysis_review_commands'].map(name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `d1000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z', who = { actor: 'admin:reviewer@example.test', reason: 'Lineage and wording reviewed.' }
const reviewFunctions = ['pattern', 'take', 'snapshot'].flatMap(kind => [`brand_watch_publish_${kind}`, `brand_watch_reject_${kind}`])

async function database({ apply021 = true } = {}) {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
  for (const sql of [m018, m019, m020]) await db.exec(sql)
  if (apply021) { await db.exec(m021); await db.exec(m021) }
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
// The supabase-js from().select().in() contract, returning PostgREST-shaped JSON rows, as service_role.
const queryClient = db => ({ from: table => ({ select: columns => ({ async in(column, values) {
  await db.exec('SET ROLE service_role')
  try { return { data: (await db.query(`SELECT row_to_json(t) AS row FROM (SELECT ${columns} FROM ${table} WHERE ${column} = ANY($1)) t`, [values])).rows.map(row => row.row), error: null } }
  catch (error) { return { data: null, error: { message: error.message } } }
  finally { await db.exec('RESET ROLE') }
} }) }) })
const insert = async (db, table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]
const review = (db, command) => executeReviewCommand(rpc(db), { ...who, ...command })
const status = async (db, table, n) => (await one(db, `SELECT status FROM ${table} WHERE id=$1`, [id(n)])).status
const events = async (db, n) => (await db.query('SELECT action,actor,reason FROM brand_watch_review_events WHERE target_id=$1 ORDER BY occurred_at,action', [id(n)])).rows.map(row => row.action)

const facts = [
  { n: 1, entity: MUSINSA, title: 'MUSINSA Beauty Festa', type: 'campaign', day: '2026-09-01' },
  { n: 2, entity: MUSINSA, title: 'Beauty specialty store expansion', type: 'platform', day: '2026-09-15' },
  { n: 3, entity: MUSINSA, title: 'Beauty creator campaign', type: 'creator', day: '2026-10-01' },
  { n: 4, entity: MUSINSA, title: 'Sneaker collaboration drop', type: 'partnership', day: '2026-09-20' },
  { n: 5, entity: TOSS, title: 'Toss card promotion', type: 'promotion', day: '2026-09-05' },
  { n: 6, entity: TOSS, title: 'Toss creator series', type: 'creator', day: '2026-09-25' },
]
// Source -> pending Evidence -> 4A approval -> draft Movement -> 4A approval.
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
// Drafts as stored by the 020 saves (inserted directly here; saves are covered by the lifecycle suite).
async function patternDraft(db, n, movementNs, { supersedes = null, revision = 1, entity = MUSINSA } = {}) {
  await insert(db, 'brand_patterns', { id: id(n), entity_id: entity, title: `Pattern ${n}`, description: 'Observed recurring activity.', window_start: '2026-09-01', window_end: '2026-10-01', confidence: 0.6, revision, supersedes_id: supersedes && id(supersedes) })
  for (const m of movementNs) await insert(db, 'pattern_movements', { entity_id: entity, pattern_id: id(n), movement_id: id(m) })
}
async function takeDraft(db, n, patternN, evidenceNs, { supersedes = null, revision = 1, entity = MUSINSA } = {}) {
  await insert(db, 'brand_takes', { id: id(n), entity_id: entity, pattern_id: id(patternN), what_we_see: 'Seen.', why_it_may_matter: 'It may matter.', what_to_watch_next: 'Watch.', revision, supersedes_id: supersedes && id(supersedes) })
  for (const e of evidenceNs) await insert(db, 'take_evidence', { entity_id: entity, take_id: id(n), evidence_id: id(e) })
}
async function snapshotDraft(db, n, takeNs, { evidenceCount = 3, sourceCount = 3, supersedes = null, revision = 1 } = {}) {
  await insert(db, 'brand_snapshots', { id: id(n), entity_id: MUSINSA, headline: `Snapshot ${n}`, body: 'Current direction.', watch_next: 'Watch.', valid_from: '2026-10-01T09:00:00Z', evidence_count: evidenceCount, source_count: sourceCount, revision, supersedes_id: supersedes && id(supersedes) })
  for (const t of takeNs) await insert(db, 'snapshot_takes', { entity_id: MUSINSA, snapshot_id: id(n), take_id: id(t) })
}
const pointer = async db => (await one(db, 'SELECT current_snapshot_id FROM brand_watch_profiles WHERE entity_id=$1', [MUSINSA]))?.current_snapshot_id ?? null

test('21/22/16-18: 021 applies, re-applies, rolls back atomically and grants review RPCs to service_role only', async () => {
  const db = await database()
  try {
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).n, 19)
    const signatures = (await db.query('SELECT oid::regprocedure::text AS s FROM pg_proc WHERE proname = ANY($1)', [reviewFunctions])).rows.map(row => row.s)
    assert.equal(signatures.length, 6)
    for (const signature of signatures) {
      for (const role of ['anon', 'authenticated']) assert.equal((await one(db, "SELECT has_function_privilege($1,$2,'EXECUTE') AS ok", [role, signature])).ok, false)
      assert.equal((await one(db, "SELECT has_function_privilege('service_role',$1,'EXECUTE') AS ok", [signature])).ok, true)
      assert.equal((await one(db, 'SELECT count(*)::int AS n FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure AND a.grantee=0', [signature])).n, 0)
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`)
      for (const fn of reviewFunctions) await assert.rejects(db.query(`SELECT public.${fn}($1,'actor','reason')`, [id(1)]), /permission denied/)
      await db.exec('RESET ROLE')
    }
    for (const row of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).rows) assert.equal((await one(db, 'SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [row.tablename])).relrowsecurity, true)
  } finally { await db.close() }
  const fresh = await database({ apply021: false })
  try {
    const applied = async () => (await one(fresh, 'SELECT count(*)::int AS n FROM pg_proc WHERE proname = ANY($1)', [reviewFunctions])).n
      + (await one(fresh, "SELECT count(*)::int AS n FROM pg_indexes WHERE indexname='brand_patterns_successor_idx' AND indexdef LIKE '%withdrawn%'")).n
    await fresh.exec(m021.replace(/COMMIT;\s*$/, 'ROLLBACK;'))
    assert.equal(await applied(), 0)
    await assert.rejects(fresh.exec(m021.replace(/COMMIT;\s*$/, 'SELECT 1/0;\nCOMMIT;')))
    await fresh.exec('ROLLBACK')
    assert.equal(await applied(), 0)
    assert.equal((await one(fresh, "SELECT count(*)::int AS n FROM pg_indexes WHERE indexname='brand_patterns_successor_idx'")).n, 1)
    await fresh.exec(m021); await fresh.exec(m021)
    assert.equal(await applied(), 7)
  } finally { await fresh.close() }
})

test('1-4: pattern publish validates lineage, reject withdraws drafts, revision publish supersedes the predecessor atomically', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 50, [1, 2, 3])
    const published = await review(db, { command: 'pattern.publish', patternId: id(50) })
    assert.deepEqual(published, { ok: true, command: 'pattern.publish', result: { patternId: id(50), supersededId: null } })
    assert.equal(await status(db, 'brand_patterns', 50), 'published'); assert.deepEqual(await events(db, 50), ['publish'])
    assert.equal((await review(db, { command: 'pattern.publish', patternId: id(50) })).code, 'INVALID_TRANSITION')
    // Invalid lineage: unapproved movement, too few independent events, merged movement, corrected evidence.
    await insert(db, 'brand_movements', { id: id(7), entity_id: MUSINSA, event_key: 'event-7', title: 'Draft pop-up', summary: 'Draft pop-up', movement_type: 'campaign', scope: 'national', importance: 1 })
    await insert(db, 'movement_evidence', { entity_id: MUSINSA, movement_id: id(7), evidence_id: id(12) })
    await patternDraft(db, 51, [1, 7]); await patternDraft(db, 52, [1])
    assert.equal((await review(db, { command: 'movement.merge', sourceMovementId: id(4), targetMovementId: id(2) })).ok, true)
    await patternDraft(db, 53, [2, 4])
    for (const [n, code] of [[51, 'INELIGIBLE_LINEAGE'], [52, 'INSUFFICIENT_INDEPENDENT_MOVEMENTS'], [53, 'INELIGIBLE_LINEAGE'], [99, 'NOT_FOUND']]) {
      assert.equal((await review(db, { command: 'pattern.publish', patternId: id(n) })).code, code, String(n))
      if (n !== 99) { assert.equal(await status(db, 'brand_patterns', n), 'draft'); assert.deepEqual(await events(db, n), []) }
    }
    assert.equal((await review(db, { command: 'evidence.supersede', evidenceId: id(13), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })).ok, true)
    await patternDraft(db, 54, [1, 3])
    assert.equal((await review(db, { command: 'pattern.publish', patternId: id(54) })).code, 'BROKEN_LINEAGE')
    // Reject: drafts only.
    assert.equal((await review(db, { command: 'pattern.reject', patternId: id(54) })).ok, true)
    assert.deepEqual([await status(db, 'brand_patterns', 54), await events(db, 54)], ['withdrawn', ['reject']])
    assert.equal((await review(db, { command: 'pattern.reject', patternId: id(54) })).code, 'INVALID_TRANSITION')
    assert.equal((await review(db, { command: 'pattern.reject', patternId: id(50) })).code, 'INVALID_TRANSITION')
  } finally { await db.close() }
})

test('4: pattern revision history - predecessor superseded with links intact; invalid predecessor rolls back; rejected revision does not block the next', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 60, [1, 2]); await review(db, { command: 'pattern.publish', patternId: id(60) })
    await patternDraft(db, 61, [1, 2, 3], { supersedes: 60, revision: 2 })
    assert.equal((await review(db, { command: 'pattern.reject', patternId: id(61) })).ok, true)
    await patternDraft(db, 62, [1, 2, 4], { supersedes: 60, revision: 2 })
    assert.deepEqual((await review(db, { command: 'pattern.publish', patternId: id(62) })).result, { patternId: id(62), supersededId: id(60) })
    assert.deepEqual([await status(db, 'brand_patterns', 60), await status(db, 'brand_patterns', 61), await status(db, 'brand_patterns', 62)], ['superseded', 'withdrawn', 'published'])
    assert.deepEqual([await events(db, 60), await events(db, 62)], [['publish', 'supersede'], ['publish']])
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM pattern_movements WHERE pattern_id=$1', [id(60)])).n, 2)
    // Predecessor no longer published (simulated unpublish): the revision publish fails as a whole.
    await patternDraft(db, 63, [1, 3], { supersedes: 62, revision: 3 })
    await db.query("UPDATE brand_patterns SET status='withdrawn' WHERE id=$1", [id(62)])
    assert.equal((await review(db, { command: 'pattern.publish', patternId: id(63) })).code, 'INVALID_PREDECESSOR')
    assert.deepEqual([await status(db, 'brand_patterns', 63), await events(db, 63)], ['draft', []])
  } finally { await db.close() }
})

test('5-8: take publish validates pattern/evidence lineage, one current take per pattern, reject and revision history', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 50, [1, 2, 3]); await review(db, { command: 'pattern.publish', patternId: id(50) })
    await patternDraft(db, 56, [1, 2])
    await takeDraft(db, 80, 50, [11, 12, 13])
    assert.deepEqual((await review(db, { command: 'take.publish', takeId: id(80) })).result, { takeId: id(80), supersededId: null })
    assert.deepEqual([await status(db, 'brand_takes', 80), await events(db, 80)], ['published', ['publish']])
    await takeDraft(db, 81, 50, [11]); await takeDraft(db, 82, 50, [14]); await takeDraft(db, 83, 56, [11])
    for (const [n, code] of [[81, 'REVISION_REQUIRED'], [82, 'BROKEN_LINEAGE'], [83, 'INELIGIBLE_LINEAGE']]) {
      assert.equal((await review(db, { command: 'take.publish', takeId: id(n) })).code, code, String(n))
      assert.deepEqual([await status(db, 'brand_takes', n), await events(db, n)], ['draft', []])
    }
    assert.equal((await review(db, { command: 'take.reject', takeId: id(83) })).ok, true)
    assert.deepEqual([await status(db, 'brand_takes', 83), await events(db, 83)], ['withdrawn', ['reject']])
    await takeDraft(db, 85, 50, [11, 12], { supersedes: 80, revision: 2 })
    assert.deepEqual((await review(db, { command: 'take.publish', takeId: id(85) })).result, { takeId: id(85), supersededId: id(80) })
    assert.deepEqual([await status(db, 'brand_takes', 80), await status(db, 'brand_takes', 85), await events(db, 80)], ['superseded', 'published', ['publish', 'supersede']])
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM take_evidence WHERE take_id=$1', [id(80)])).n, 3)
    // Corrected evidence breaks the next revision's lineage.
    await takeDraft(db, 86, 50, [11], { supersedes: 85, revision: 3 })
    await review(db, { command: 'evidence.supersede', evidenceId: id(11), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })
    assert.equal((await review(db, { command: 'take.publish', takeId: id(86) })).code, 'BROKEN_LINEAGE')
    assert.equal(await status(db, 'brand_takes', 85), 'published')
  } finally { await db.close() }
})

test('9-13: snapshot publish records the reviewer and switches current_snapshot_id atomically; failures roll the pointer back', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 50, [1, 2, 3]); await review(db, { command: 'pattern.publish', patternId: id(50) })
    await takeDraft(db, 80, 50, [11, 12, 13])
    await snapshotDraft(db, 89, [80])
    assert.equal((await review(db, { command: 'snapshot.publish', snapshotId: id(89) })).code, 'INELIGIBLE_LINEAGE')
    await review(db, { command: 'take.publish', takeId: id(80) })
    assert.equal(await pointer(db), null)
    const first = await review(db, { command: 'snapshot.publish', snapshotId: id(89) })
    assert.deepEqual(first.result, { snapshotId: id(89), supersededId: null, previousCurrentSnapshotId: null })
    const row = await one(db, 'SELECT status,reviewed_by,reviewed_at FROM brand_snapshots WHERE id=$1', [id(89)])
    assert.deepEqual([row.status, row.reviewed_by, row.reviewed_at !== null], ['published', who.actor, true])
    assert.deepEqual({ ...(await one(db, 'SELECT current_snapshot_id,public_status,seo_status,watch_status FROM brand_watch_profiles WHERE entity_id=$1', [MUSINSA])) }, { current_snapshot_id: id(89), public_status: 'private', seo_status: 'noindex', watch_status: 'paused' })
    // Without a declared predecessor a second publish is refused; wrong counts are refused; pointer unchanged.
    await snapshotDraft(db, 90, [80])
    assert.equal((await review(db, { command: 'snapshot.publish', snapshotId: id(90) })).code, 'REVISION_REQUIRED')
    await review(db, { command: 'snapshot.reject', snapshotId: id(90) })
    await snapshotDraft(db, 91, [80], { supersedes: 89, revision: 2, sourceCount: 2 })
    assert.equal((await review(db, { command: 'snapshot.publish', snapshotId: id(91) })).code, 'COVERAGE_COUNT_MISMATCH')
    assert.equal((await review(db, { command: 'snapshot.reject', snapshotId: id(91) })).ok, true)
    assert.deepEqual([await pointer(db), await status(db, 'brand_snapshots', 89), await events(db, 91)], [id(89), 'published', ['reject']])
    // A failure after the pointer switch (final audit insert) rolls back pointer, supersession and publication.
    await snapshotDraft(db, 92, [80], { supersedes: 89, revision: 2 })
    await db.exec("CREATE FUNCTION fail_publish_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='publish' THEN RAISE EXCEPTION 'simulated audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_publish_event BEFORE INSERT ON brand_watch_review_events FOR EACH ROW EXECUTE FUNCTION fail_publish_event();")
    assert.equal((await review(db, { command: 'snapshot.publish', snapshotId: id(92) })).code, 'DATABASE_ERROR')
    assert.deepEqual([await pointer(db), await status(db, 'brand_snapshots', 89), await status(db, 'brand_snapshots', 92), await events(db, 89)], [id(89), 'published', 'draft', ['publish']])
    await db.exec('DROP TRIGGER fail_publish_event ON brand_watch_review_events')
    // Successful revision: new current snapshot, predecessor superseded, history and links preserved.
    assert.deepEqual((await review(db, { command: 'snapshot.publish', snapshotId: id(92) })).result, { snapshotId: id(92), supersededId: id(89), previousCurrentSnapshotId: id(89) })
    assert.deepEqual([await pointer(db), await status(db, 'brand_snapshots', 89), await status(db, 'brand_snapshots', 92)], [id(92), 'superseded', 'published'])
    assert.deepEqual([await events(db, 89), await events(db, 92)], [['publish', 'supersede'], ['publish']])
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM snapshot_takes WHERE snapshot_id=$1', [id(89)])).n, 1)
    assert.equal((await review(db, { command: 'snapshot.reject', snapshotId: id(92) })).code, 'INVALID_TRANSITION')
  } finally { await db.close() }
})

test('14/15: actor and reason are required, and every mutation writes exactly one event per changed row', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 50, [1, 2, 3])
    let called = false
    const blank = await executeReviewCommand({ rpc: async () => { called = true; return { data: null, error: null } } }, { command: 'pattern.publish', patternId: id(50), actor: ' ', reason: 'x' })
    assert.deepEqual([blank, called], [{ ok: false, code: 'INVALID_COMMAND' }, false])
    for (const command of ['pattern.publish', 'take.reject', 'snapshot.publish']) assert.equal(reviewCommandSchema.safeParse({ command, patternId: id(50), takeId: id(50), snapshotId: id(50), actor: 'a' }).success, false)
    for (const fn of reviewFunctions) assert.match((await rpc(db).rpc(fn, { [`p_${fn.split('_').at(-1)}_id`]: id(50), p_actor: 'admin', p_reason: '  ' })).error.message, /PROVENANCE_REQUIRED/)
    assert.equal(await status(db, 'brand_patterns', 50), 'draft')
    const before = (await one(db, 'SELECT count(*)::int AS n FROM brand_watch_review_events')).n
    await review(db, { command: 'pattern.publish', patternId: id(50), actor: '  admin:lee  ', reason: '  Checked.  ' })
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_watch_review_events')).n, before + 1)
    assert.deepEqual((await db.query('SELECT target_type,target_id,action,actor,reason FROM brand_watch_review_events WHERE target_id=$1', [id(50)])).rows.map(row => ({ ...row })), [{ target_type: 'pattern', target_id: id(50), action: 'publish', actor: 'admin:lee', reason: 'Checked.' }])
  } finally { await db.close() }
})

test('19/20 (pure): buildLineageGraph keeps one entity and shapes PostgREST rows for the health checker', () => {
  const rows = {
    movements: [{ id: id(1), entity_id: MUSINSA, event_key: 'e1', title: 'A', summary: 'A', movement_type: 'campaign', status: 'published', merged_into_id: null, started_at: null, last_observed_at: '2026-09-01T09:00:00+00:00' },
      { id: id(5), entity_id: TOSS, event_key: 'e5', title: 'T', summary: 'T', movement_type: 'promotion', status: 'published', merged_into_id: null, started_at: null, last_observed_at: '2026-09-05T09:00:00+00:00' }],
    movementEvidence: [{ movement_id: id(1), evidence_id: id(11) }, { movement_id: id(5), evidence_id: id(15) }],
    evidence: [{ id: id(11), entity_id: MUSINSA, source_item_id: id(101), fact: 'F', event_date: '2026-09-01', review_status: 'approved', status: 'active', marketing_relevance: '1' }],
    sources: [{ id: id(101), provider_id: id(201), canonical_url: 'https://p1.example.test/a', content_hash: '1'.repeat(64), published_at: null }],
    providers: [{ id: id(201), provider_type: 'industry_media' }],
    matches: [{ source_item_id: id(101), entity_id: TOSS, role: 'mentioned', review_status: 'pending' }, { source_item_id: id(101), entity_id: MUSINSA, role: 'primary', review_status: 'approved' }],
    patterns: [{ id: id(50), entity_id: MUSINSA, title: 'P', description: 'D', window_start: '2026-09-01', window_end: '2026-10-01', status: 'draft', revision: 1 }],
    patternMovements: [{ pattern_id: id(50), movement_id: id(1) }], takes: [], takeEvidence: [], snapshots: [], snapshotTakes: [],
  }
  const graph = buildLineageGraph(MUSINSA, rows)
  assert.deepEqual(graph.movements.map(row => row.id), [id(1)])
  assert.deepEqual(graph.movements[0].evidence[0], { id: id(11), entityId: MUSINSA, sourceItemId: id(101), fact: 'F', eventDate: '2026-09-01', reviewStatus: 'approved', status: 'active', marketingRelevance: 1, matchRole: 'primary', matchReviewStatus: 'approved', source: { providerId: id(201), providerType: 'industry_media', canonicalUrl: 'https://p1.example.test/a', contentHash: '1'.repeat(64), publishedAt: null } })
  // A single-link pattern is loadable and reported BROKEN rather than rejected at load time.
  assert.deepEqual(evaluateLineageHealth(graph, generatedAt).results.find(row => row.kind === 'pattern').reasons, ['INSUFFICIENT_INDEPENDENT_MOVEMENTS'])
  assert.ok(!JSON.stringify(graph).includes(id(5)) && !JSON.stringify(graph).includes(TOSS))
})

test('19/20: the DB loader feeds the health checker read-only, isolates entities and reports corrections', async () => {
  const db = await database()
  try {
    await seedFacts(db)
    await patternDraft(db, 50, [1, 2, 3]); await review(db, { command: 'pattern.publish', patternId: id(50) })
    await takeDraft(db, 80, 50, [11, 12, 13]); await review(db, { command: 'take.publish', takeId: id(80) })
    await snapshotDraft(db, 90, [80]); await review(db, { command: 'snapshot.publish', snapshotId: id(90) })
    await patternDraft(db, 57, [5, 6], { entity: TOSS }); await review(db, { command: 'pattern.publish', patternId: id(57) })
    const counts = async () => ({ ...(await one(db, 'SELECT (SELECT count(*) FROM brand_evidence)::int e,(SELECT count(*) FROM brand_patterns)::int p,(SELECT count(*) FROM brand_watch_review_events)::int r,(SELECT max(updated_at) FROM brand_movements) u')) })
    const before = await counts()
    const graph = await loadLineageGraph(queryClient(db), MUSINSA)
    assert.deepEqual(await counts(), before)
    assert.deepEqual([graph.movements.length, graph.patterns.map(row => row.id), graph.takes.map(row => row.id), graph.snapshots.map(row => row.id)], [4, [id(50)], [id(80)], [id(90)]])
    assert.ok(!JSON.stringify(graph).includes(TOSS) && !JSON.stringify(graph).includes(id(57)))
    assert.deepEqual(evaluateLineageHealth(graph, generatedAt).summary, { HEALTHY: 7, STALE: 0, REVIEW_REQUIRED: 0, BROKEN: 0 })
    assert.equal((await loadLineageGraph(queryClient(db), TOSS)).patterns[0].id, id(57))
    await review(db, { command: 'evidence.supersede', evidenceId: id(11), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })
    const report = evaluateLineageHealth(await loadLineageGraph(queryClient(db), MUSINSA), generatedAt)
    assert.deepEqual(correctionImpact(report, `evidence:${id(11)}`).map(row => [row.kind, row.health]), [['movement', 'REVIEW_REQUIRED'], ['pattern', 'STALE'], ['take', 'STALE'], ['snapshot', 'STALE']])
    await assert.rejects(loadLineageGraph({ from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'secret row data' } }) }) }) }, MUSINSA), error => error.message === 'LINEAGE_LOAD_FAILED')
  } finally { await db.close() }
})
