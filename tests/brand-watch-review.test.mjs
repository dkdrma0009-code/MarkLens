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
const { executeReviewCommand, reviewCommandSchema } = load('src/lib/brand-watch/review/commands.ts')
const foundation = readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8')
const review = readFileSync('supabase/migrations/019_brand_watch_review_commands.sql', 'utf8')
const id = n => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = id(1), B = id(2), who = { actor: 'admin:reviewer@example.test', reason: 'Checked against the quoted source span' }

async function database() {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
  await db.exec(foundation); await db.exec(review); await db.exec(review)
  for (const [entity, slug] of [[A, 'alpha'], [B, 'beta']]) await db.query("INSERT INTO brand_entities(id,slug,name,name_ko,entity_type,category) VALUES($1,$2,$2,$2,'brand','retail')", [entity, slug])
  await db.query("INSERT INTO source_providers(id,name,domain,provider_type,source_tier,reliability_policy,ingestion_method) VALUES($1,'News','example.test','official_newsroom',1,'Attribution only','manual')", [id(3)])
  for (const [source, entity] of [[id(10), A], [id(11), A], [id(12), B]]) {
    await db.query("INSERT INTO source_items(id,provider_id,canonical_url,original_url,title,date_precision,content_hash) VALUES($1,$2,$3,$3,'Event','unknown',$4)", [source, id(3), 'https://example.test/' + source, source.slice(-1).repeat(64)])
    await db.query("INSERT INTO source_entity_matches(source_item_id,entity_id,role,confidence,method,review_status) VALUES($1,$2,'mentioned',0.7,'model','pending')", [source, entity])
  }
  await db.exec('SET ROLE service_role')
  return db
}
const evidence = (db, n, source = id(10), entity = A) => db.query("INSERT INTO brand_evidence(id,entity_id,source_item_id,fact,support_text,date_precision,marketing_relevance,confidence,extraction_method,review_status) VALUES($1,$2,$3,$4,'Supporting fragment','unknown',1,0.7,'manual','pending')", [id(n), entity, source, 'Fact ' + id(n)])
async function movement(db, n, evidenceIds, entity = A) {
  await db.query("INSERT INTO brand_movements(id,entity_id,event_key,title,summary,movement_type,scope,importance) VALUES($1,$2,$3,'Event','Summary','campaign','national',1)", [id(n), entity, 'event-' + n])
  for (const evidenceId of evidenceIds) await db.query('INSERT INTO movement_evidence(entity_id,movement_id,evidence_id) VALUES($1,$2,$3)', [entity, id(n), evidenceId])
}
// The same supabase-js rpc contract, executed against actual PostgreSQL in one autocommit statement.
const rpc = db => ({ async rpc(fn, args) {
  const keys = Object.keys(args)
  try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
  catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
} })
const run = (db, command) => executeReviewCommand(rpc(db), { ...who, ...command })
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]
// Which review happened to which target. Not chronological: occurred_at can tie (PGlite's clock is millisecond),
// so rows are ordered by target and action instead of by an id that is random within a tie.
const events = async db => (await db.query('SELECT target_type,target_id,action,actor,reason FROM brand_watch_review_events ORDER BY target_type,target_id,action')).rows
const approvedEvidence = async (db, n, source = id(10)) => { await evidence(db, n, source); assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(n), matchRole: 'primary' })).ok, true) }

test('019 is repeat-safe, adds no tables, and exposes review RPCs to service_role only', async () => {
  const db = await database(); try {
    await db.exec('RESET ROLE')
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).n, 19)
    const functions = (await db.query("SELECT p.oid::regprocedure::text AS signature FROM pg_proc p WHERE p.proname LIKE 'brand_watch\\_%\\_evidence' OR p.proname LIKE 'brand_watch\\_%\\_movement'")).rows
    assert.equal(functions.length, 7)
    for (const { signature } of functions) {
      for (const role of ['anon', 'authenticated']) assert.equal((await one(db, "SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).allowed, false)
      assert.equal((await one(db, "SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed", [signature])).allowed, true)
    }
    await evidence(db, 20)
    await db.exec('SET ROLE authenticated')
    await assert.rejects(db.query("SELECT public.brand_watch_reject_evidence($1,'x','y')", [id(20)]), /permission denied/)
  } finally { await db.close() }
})

test('actor/reason provenance is required by the command schema and independently by SQL', async () => {
  const db = await database(); try {
    await evidence(db, 20)
    let called = false
    const blank = await executeReviewCommand({ rpc: async () => { called = true; return { data: null, error: null } } }, { command: 'evidence.reject', evidenceId: id(20), actor: ' ', reason: 'x' })
    assert.deepEqual([blank, called], [{ ok: false, code: 'INVALID_COMMAND' }, false])
    assert.equal(reviewCommandSchema.safeParse({ command: 'evidence.reject', evidenceId: id(20), actor: 'a' }).success, false)
    assert.equal(reviewCommandSchema.safeParse({ command: 'evidence.reject', evidenceId: id(20), ...who, extra: true }).success, false)
    const direct = await rpc(db).rpc('brand_watch_reject_evidence', { p_evidence_id: id(20), p_actor: 'admin', p_reason: '   ' })
    assert.match(direct.error.message, /BW_REVIEW:PROVENANCE_REQUIRED/)
    assert.equal((await one(db, 'SELECT review_status FROM brand_evidence WHERE id=$1', [id(20)])).review_status, 'pending')
    assert.deepEqual(await events(db), [])
  } finally { await db.close() }
})

test('evidence approve adjudicates the source match role and records one audit event', async () => {
  const db = await database(); try {
    await evidence(db, 20); await evidence(db, 21)
    const result = await run(db, { command: 'evidence.approve', evidenceId: id(20), matchRole: 'primary' })
    assert.equal(result.ok, true); assert.equal(result.result.matchRole, 'primary')
    assert.equal((await one(db, 'SELECT review_status FROM brand_evidence WHERE id=$1', [id(20)])).review_status, 'approved')
    assert.deepEqual({ ...(await one(db, 'SELECT role,review_status FROM source_entity_matches WHERE source_item_id=$1', [id(10)])) }, { role: 'primary', review_status: 'approved' })
    assert.deepEqual(await events(db), [{ target_type: 'evidence', target_id: id(20), action: 'approve', actor: who.actor, reason: who.reason }])
    // A conflicting role for the same source/entity fails as a whole: evidence stays pending, no event.
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(21), matchRole: 'secondary' })).code, 'MATCH_ROLE_CONFLICT')
    assert.equal((await one(db, 'SELECT review_status FROM brand_evidence WHERE id=$1', [id(21)])).review_status, 'pending')
    assert.equal((await events(db)).length, 1)
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(21), matchRole: 'primary' })).ok, true)
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(20), matchRole: 'primary' })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'evidence.reject', evidenceId: id(20) })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'evidence.reject', evidenceId: id(99) })).code, 'NOT_FOUND')
  } finally { await db.close() }
})

test('evidence reject is terminal and cannot be re-approved', async () => {
  const db = await database(); try {
    await evidence(db, 20)
    assert.equal((await run(db, { command: 'evidence.reject', evidenceId: id(20) })).ok, true)
    assert.equal((await one(db, 'SELECT review_status FROM brand_evidence WHERE id=$1', [id(20)])).review_status, 'rejected')
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(20), matchRole: 'primary' })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'evidence.reject', evidenceId: id(20) })).code, 'INVALID_TRANSITION')
    assert.deepEqual((await events(db)).map(row => row.action), ['reject'])
  } finally { await db.close() }
})

const correction = { sourceItemId: null, fact: 'Corrected fact', supportText: 'Corrected supporting fragment', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.6 }
test('evidence supersede creates one pending successor and preserves the approved predecessor', async () => {
  const db = await database(); try {
    await approvedEvidence(db, 20); await evidence(db, 21)
    const result = await run(db, { command: 'evidence.supersede', evidenceId: id(20), successor: correction })
    assert.equal(result.ok, true)
    const old = await one(db, 'SELECT status,review_status,fact FROM brand_evidence WHERE id=$1', [id(20)])
    assert.deepEqual({ ...old }, { status: 'superseded', review_status: 'approved', fact: 'Fact ' + id(20) })
    const next = await one(db, 'SELECT entity_id,source_item_id,supersedes_id,correction_reason,review_status,status,extraction_method FROM brand_evidence WHERE id=$1', [result.result.successorId])
    assert.deepEqual({ ...next }, { entity_id: A, source_item_id: id(10), supersedes_id: id(20), correction_reason: who.reason, review_status: 'pending', status: 'active', extraction_method: 'manual' })
    assert.equal((await run(db, { command: 'evidence.supersede', evidenceId: id(20), successor: correction })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'evidence.supersede', evidenceId: id(21), successor: correction })).code, 'INVALID_TRANSITION')
    // Successor source must exist; failure leaves predecessor active and no event.
    await approvedEvidence(db, 22)
    assert.equal((await run(db, { command: 'evidence.supersede', evidenceId: id(22), successor: { ...correction, sourceItemId: id(98) } })).code, 'DATABASE_ERROR')
    assert.equal((await one(db, 'SELECT status FROM brand_evidence WHERE id=$1', [id(22)])).status, 'active')
    assert.deepEqual((await events(db)).map(row => row.action), ['approve', 'supersede', 'approve'])
  } finally { await db.close() }
})

test('movement approve publishes reviewed evidence; deferred publication failure rolls back the audit event', async () => {
  const db = await database(); try {
    await evidence(db, 20); await movement(db, 30, [id(20)])
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(30) })).code, 'PUBLICATION_REQUIREMENTS_UNMET')
    assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'draft')
    assert.deepEqual(await events(db), [])
    // Approved but mention-only evidence cannot publish a movement either.
    await evidence(db, 21, id(11)); await movement(db, 31, [id(21)])
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(21), matchRole: 'mentioned' })).ok, true)
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(31) })).code, 'PUBLICATION_REQUIREMENTS_UNMET')
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(20), matchRole: 'primary' })).ok, true)
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(30) })).ok, true)
    assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'published')
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(30) })).code, 'INVALID_TRANSITION')
    assert.deepEqual((await events(db)).map(row => `${row.target_type}:${row.action}`), ['evidence:approve', 'evidence:approve', 'movement:approve'])
  } finally { await db.close() }
})

test('movement reject withdraws drafts only', async () => {
  const db = await database(); try {
    await approvedEvidence(db, 20); await movement(db, 30, [id(20)]); await movement(db, 31, [id(20)])
    assert.equal((await run(db, { command: 'movement.reject', movementId: id(30) })).ok, true)
    assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'withdrawn')
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(30) })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'movement.approve', movementId: id(31) })).ok, true)
    assert.equal((await run(db, { command: 'movement.reject', movementId: id(31) })).code, 'INVALID_TRANSITION')
  } finally { await db.close() }
})

const successor = { eventKey: 'event-corrected', title: 'Corrected event', summary: 'Corrected summary', movementType: 'campaign', scope: 'national', market: ['KR'], channel: ['online'], startedAt: null, lastObservedAt: null, importance: 2 }
test('movement supersede creates a linked draft successor atomically and keeps the published history', async () => {
  const db = await database(); try {
    await approvedEvidence(db, 20); await evidence(db, 21); await movement(db, 30, [id(20)])
    await evidence(db, 22); await run(db, { command: 'evidence.reject', evidenceId: id(22) })
    assert.equal((await run(db, { command: 'movement.supersede', movementId: id(30), successor: { ...successor, evidenceIds: [id(20)] } })).code, 'INVALID_TRANSITION')
    await run(db, { command: 'movement.approve', movementId: id(30) })
    const before = (await events(db)).length
    for (const [evidenceIds, code] of [[[id(22)], 'SUCCESSOR_EVIDENCE_INVALID'], [[id(99)], 'SUCCESSOR_EVIDENCE_INVALID'], [[id(20)], 'EVENT_KEY_CONFLICT']]) {
      const key = code === 'EVENT_KEY_CONFLICT' ? 'event-30' : successor.eventKey
      assert.equal((await run(db, { command: 'movement.supersede', movementId: id(30), successor: { ...successor, eventKey: key, evidenceIds } })).code, code)
      assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'published')
      assert.equal((await one(db, 'SELECT count(*)::int AS n FROM brand_movements')).n, 1)
      assert.equal((await events(db)).length, before)
    }
    const result = await run(db, { command: 'movement.supersede', movementId: id(30), successor: { ...successor, evidenceIds: [id(20), id(21)] } })
    assert.equal(result.ok, true)
    assert.deepEqual({ ...(await one(db, 'SELECT status,merged_into_id FROM brand_movements WHERE id=$1', [id(30)])) }, { status: 'superseded', merged_into_id: result.result.successorId })
    assert.deepEqual({ ...(await one(db, 'SELECT status,event_key,importance FROM brand_movements WHERE id=$1', [result.result.successorId])) }, { status: 'draft', event_key: 'event-corrected', importance: 2 })
    assert.deepEqual((await db.query('SELECT evidence_id FROM movement_evidence WHERE movement_id=$1 ORDER BY evidence_id', [result.result.successorId])).rows.map(row => row.evidence_id), [id(20), id(21)])
    assert.deepEqual((await db.query('SELECT evidence_id FROM movement_evidence WHERE movement_id=$1', [id(30)])).rows.map(row => row.evidence_id), [id(20)])
    assert.ok((await events(db)).some(row => row.target_id === id(30) && row.action === 'supersede'))
    assert.equal((await run(db, { command: 'movement.supersede', movementId: id(30), successor: { ...successor, eventKey: 'again', evidenceIds: [id(20)] } })).code, 'INVALID_TRANSITION')
  } finally { await db.close() }
})

test('movement merge preserves evidence lineage and is safe to repeat', async () => {
  const db = await database(); try {
    for (const n of [20, 21, 22]) await evidence(db, n)
    await run(db, { command: 'evidence.reject', evidenceId: id(22) })
    await movement(db, 30, [id(20), id(21), id(22)]); await movement(db, 31, [id(20)]); await movement(db, 32, [id(21)])
    const links = async n => (await db.query('SELECT evidence_id FROM movement_evidence WHERE movement_id=$1 ORDER BY evidence_id', [id(n)])).rows.map(row => row.evidence_id)
    const merged = await run(db, { command: 'movement.merge', sourceMovementId: id(30), targetMovementId: id(31) })
    assert.deepEqual([merged.ok, merged.result.noop, merged.result.copiedLinks], [true, false, 1])
    assert.deepEqual(await links(31), [id(20), id(21)])
    assert.deepEqual(await links(30), [id(20), id(21), id(22)])
    assert.deepEqual({ ...(await one(db, 'SELECT status,merged_into_id FROM brand_movements WHERE id=$1', [id(30)])) }, { status: 'superseded', merged_into_id: id(31) })
    const count = (await events(db)).length
    const again = await run(db, { command: 'movement.merge', sourceMovementId: id(30), targetMovementId: id(31) })
    assert.deepEqual([again.ok, again.result.noop, again.result.copiedLinks], [true, true, 0])
    assert.equal((await events(db)).length, count); assert.deepEqual(await links(31), [id(20), id(21)])
    assert.equal((await run(db, { command: 'movement.merge', sourceMovementId: id(30), targetMovementId: id(32) })).code, 'INVALID_TRANSITION')
    assert.equal((await run(db, { command: 'movement.merge', sourceMovementId: id(32), targetMovementId: id(30) })).code, 'INVALID_MERGE_TARGET')
    assert.equal((await run(db, { command: 'movement.merge', sourceMovementId: id(31), targetMovementId: id(31) })).code, 'INVALID_COMMAND')
    assert.match((await rpc(db).rpc('brand_watch_merge_movement', { p_source_id: id(31), p_target_id: id(31), p_actor: 'a', p_reason: 'r' })).error.message, /SELF_MERGE/)
    await evidence(db, 23, id(12), B); await movement(db, 33, [id(23)], B)
    assert.equal((await run(db, { command: 'movement.merge', sourceMovementId: id(33), targetMovementId: id(31) })).code, 'ENTITY_MISMATCH')
    assert.equal((await events(db)).length, count)
  } finally { await db.close() }
})

test('merging into a published movement leaves its frozen links intact and keeps lineage via merged_into_id', async () => {
  const db = await database(); try {
    await approvedEvidence(db, 20); await evidence(db, 21)
    await movement(db, 30, [id(20)]); await run(db, { command: 'movement.approve', movementId: id(30) })
    await movement(db, 31, [id(21)])
    const result = await run(db, { command: 'movement.merge', sourceMovementId: id(31), targetMovementId: id(30) })
    assert.deepEqual([result.ok, result.result.copiedLinks], [true, 0])
    assert.deepEqual((await db.query('SELECT evidence_id FROM movement_evidence WHERE movement_id=$1', [id(30)])).rows.map(row => row.evidence_id), [id(20)])
    const lineage = (await db.query('SELECT me.evidence_id FROM brand_movements m JOIN movement_evidence me ON me.movement_id=m.id WHERE m.id=$1 OR m.merged_into_id=$1 ORDER BY 1', [id(30)])).rows.map(row => row.evidence_id)
    assert.deepEqual(lineage, [id(20), id(21)])
    assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'published')
  } finally { await db.close() }
})

test('a failure after state changes (audit insert) rolls back the whole command', async () => {
  const db = await database(); try {
    await evidence(db, 20); await evidence(db, 21); await movement(db, 30, [id(20)]); await movement(db, 31, [id(21)])
    await db.exec('RESET ROLE')
    await db.exec("CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON brand_watch_review_events FOR EACH ROW EXECUTE FUNCTION fail_audit();")
    await db.exec('SET ROLE service_role')
    assert.equal((await run(db, { command: 'evidence.approve', evidenceId: id(20), matchRole: 'primary' })).code, 'DATABASE_ERROR')
    assert.equal((await one(db, 'SELECT review_status FROM brand_evidence WHERE id=$1', [id(20)])).review_status, 'pending')
    assert.deepEqual({ ...(await one(db, 'SELECT role,review_status FROM source_entity_matches WHERE source_item_id=$1', [id(10)])) }, { role: 'mentioned', review_status: 'pending' })
    assert.equal((await run(db, { command: 'movement.merge', sourceMovementId: id(30), targetMovementId: id(31) })).code, 'DATABASE_ERROR')
    assert.equal((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [id(30)])).status, 'draft')
    assert.equal((await one(db, 'SELECT count(*)::int AS n FROM movement_evidence WHERE movement_id=$1', [id(31)])).n, 1)
    assert.ok(!JSON.stringify(await run(db, { command: 'evidence.reject', evidenceId: id(20) })).includes('simulated'))
  } finally { await db.close() }
})
