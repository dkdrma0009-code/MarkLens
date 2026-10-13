import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const cache = new Map()
function load(name) {
  if (cache.has(name)) return cache.get(name)
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(`src/lib/brand-watch/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('require', 'module', 'exports', code)(key => key.startsWith('./') ? load(key.slice(2)) : require(key), loaded, loaded.exports)
  cache.set(name, loaded.exports)
  return loaded.exports
}
const schemas = load('schemas'), registry = load('registry')
const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const revision = { revision: 1, supersedesId: null, status: 'draft', provenance: null }
function lineage() {
  const source = { id: id(2), providerId: id(3), canonicalUrl: 'https://example.test/story', originalUrl: 'https://example.test/story', title: 'Event', publishedAt: null, datePrecision: 'unknown', contentHash: 'a'.repeat(64), existingArticleId: null }
  const evidence = { id: id(4), entityId: id(1), sourceItemId: id(2), fact: 'A campaign launched', supportText: 'Campaign launched', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.8, extractionMethod: 'manual', reviewStatus: 'approved', supersedesId: null, provenance: null }
  const movement = { id: id(5), entityId: id(1), eventKey: 'campaign-a', title: 'Campaign', summary: 'Launch', movementType: 'campaign', scope: 'national', market: ['KR'], channel: ['online'], evidenceIds: [id(4)], status: 'draft' }
  return { sources: [source], matches: [{ sourceItemId: id(2), entityId: id(1), role: 'primary', confidence: 0.8, method: 'manual', reviewStatus: 'approved' }], evidence: [evidence], movements: [movement, { ...movement, id: id(6), eventKey: 'campaign-b' }], patterns: [{ id: id(7), entityId: id(1), title: 'Direction', description: 'Two events', windowStart: '2026-01-01', windowEnd: '2026-10-01', movementIds: [id(5), id(6)], confidence: 0.8, ...revision }], takes: [{ id: id(8), entityId: id(1), patternId: id(7), whatWeSee: 'Observation', whyItMayMatter: 'Interpretation', whatToWatchNext: 'Next observation', evidenceIds: [id(4)], ...revision }], snapshots: [{ id: id(9), entityId: id(1), headline: 'Direction', body: 'Interpretation', validFrom: '2026-10-01T00:00:00Z', validUntil: null, takeIds: [id(8)], evidenceCount: 1, sourceCount: 1, ...revision }] }
}

test('launch registry has exactly five stable unique slugs and IDs', () => {
  assert.deepEqual(registry.launchRegistry.map(row => row.slug), ['musinsa', 'olive-young', 'toss', 'baemin', 'danggeun'])
  assert.equal(new Set(registry.launchRegistry.map(row => row.entity.id)).size, 5)
})
test('aliases normalize NFKC, case and whitespace without merging entity boundaries', () => {
  assert.equal(registry.resolveLaunchAlias(' ＴＯＳＳ '), 'toss')
  assert.equal(registry.resolveLaunchAlias('olive   young'), 'olive-young')
  assert.equal(registry.resolveLaunchAlias('Toss Bank'), undefined)
  assert.equal(registry.resolveLaunchAlias('29CM'), undefined)
  assert.equal(schemas.normalizeAlias('올리브 영'), '올리브 영')
})
test('controlled relations reject free-form and self relations', () => {
  assert.ok(schemas.relationSchema.safeParse({ fromEntityId: id(1), toEntityId: id(2), relationType: 'service_of' }).success)
  assert.ok(!schemas.relationSchema.safeParse({ fromEntityId: id(1), toEntityId: id(1), relationType: 'related_brand' }).success)
  assert.ok(!schemas.relationSchema.safeParse({ fromEntityId: id(1), toEntityId: id(2), relationType: 'anything' }).success)
})
test('movement taxonomy keeps offline/global in dimensions; unknown AI fields are rejected', () => {
  const movement = lineage().movements[0]
  for (const movementType of ['offline', 'global']) assert.ok(!schemas.movementSchema.safeParse({ ...movement, movementType }).success)
  assert.ok(!schemas.movementSchema.safeParse({ ...movement, inventedScore: 90 }).success)
})
test('source/evidence/movement lineage accepts supported facts and rejects missing fragments/provenance', () => {
  assert.ok(schemas.lineageSchema.safeParse(lineage()).success)
  const graph = lineage(); graph.evidence[0].sourceItemId = id(99)
  assert.ok(!schemas.lineageSchema.safeParse(graph).success)
  assert.ok(!schemas.evidenceSchema.safeParse({ ...lineage().evidence[0], supportText: null }).success)
  assert.ok(!schemas.evidenceSchema.safeParse({ ...lineage().evidence[0], extractionMethod: 'model' }).success)
})
test('mention and unreviewed primary matches never qualify as an action', () => {
  const graph = lineage(); graph.matches[0].role = 'mentioned'
  assert.equal(schemas.canSupportAction(graph.matches[0]), false)
  assert.ok(!schemas.lineageSchema.safeParse(graph).success)
  graph.matches[0].role = 'primary'; graph.matches[0].reviewStatus = 'pending'
  assert.ok(!schemas.lineageSchema.safeParse(graph).success)
})
test('pattern requires at least two independent same-entity movements', () => {
  const graph = lineage(); graph.movements[1].eventKey = graph.movements[0].eventKey
  assert.ok(!schemas.lineageSchema.safeParse(graph).success)
  assert.ok(!schemas.patternSchema.safeParse({ ...graph.patterns[0], movementIds: [id(5)] }).success)
})
test('take and snapshot lineage reject unrelated evidence and missing take', () => {
  const graph = lineage(); graph.takes[0].evidenceIds = [id(99)]
  assert.ok(!schemas.lineageSchema.safeParse(graph).success)
  const other = lineage(); other.snapshots[0].takeIds = [id(99)]
  assert.ok(!schemas.lineageSchema.safeParse(other).success)
})
test('eligibility separates public and SEO thresholds, with explicit time input', () => {
  const input = { recentMovementCount: 3, distinctSourceCount: 2, takeCount: 1, hasSnapshot: true, lastMeaningfulUpdateAt: '2026-10-01T00:00:00Z' }
  assert.deepEqual(schemas.evaluateEligibility(input, new Date('2026-10-13')), { publicCandidate: true, seoCandidate: false })
  assert.equal(schemas.evaluateEligibility({ ...input, distinctSourceCount: 3 }, new Date('2026-10-13')).seoCandidate, true)
  assert.equal(schemas.evaluateEligibility({ ...input, distinctSourceCount: 3 }, new Date('2027-10-13')).seoCandidate, false)
})

const sql = readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8')
async function database() {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
  await db.exec(sql); await db.exec(sql)
  return db
}
test('migration is repeat-safe, creates 19 isolated tables with RLS and denies anonymous/authenticated access', async () => {
  const db = await database()
  try {
    const rows = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'articles'")).rows
    assert.equal(rows.length, 19)
    for (const row of rows) {
      for (const role of ['anon', 'authenticated']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, row.tablename, privilege])).rows[0].allowed, false)
      assert.equal((await db.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [row.tablename])).rows[0].relrowsecurity, true)
      assert.equal((await db.query("SELECT has_table_privilege('service_role',$1,'INSERT') AS allowed", [row.tablename])).rows[0].allowed, true)
    }
    await db.exec('SET ROLE anon')
    await assert.rejects(db.exec("INSERT INTO themes(slug,name) VALUES('x','x')"), /permission denied/)
  } finally { await db.close() }
})
async function seed(db) {
  await db.query("INSERT INTO brand_entities(id,slug,name,name_ko,entity_type,category) VALUES($1,'test','Test','테스트','brand','retail')", [id(1)])
  await db.query("INSERT INTO source_providers(id,name,domain,provider_type,source_tier,reliability_policy,ingestion_method) VALUES($1,'News','example.test','official_newsroom',1,'Attribution only','manual')", [id(3)])
  await db.query("INSERT INTO source_items(id,provider_id,canonical_url,original_url,title,date_precision,content_hash) VALUES($1,$2,'https://example.test/a','https://example.test/a','Event','unknown',$3)", [id(2), id(3), 'a'.repeat(64)])
  await db.query("INSERT INTO source_entity_matches(source_item_id,entity_id,role,confidence,method,review_status) VALUES($1,$2,'primary',1,'manual','approved')", [id(2), id(1)])
  await db.query("INSERT INTO brand_evidence(id,entity_id,source_item_id,fact,support_text,date_precision,marketing_relevance,confidence,extraction_method,review_status) VALUES($1,$2,$3,'Fact','Fragment','unknown',1,1,'manual','approved')", [id(4), id(1), id(2)])
  for (const n of [5, 6]) {
    await db.query("INSERT INTO brand_movements(id,entity_id,event_key,title,summary,movement_type,scope,importance) VALUES($1,$2,$3,'Event','Summary','campaign','national',1)", [id(n), id(1), 'event-' + n])
    await db.query('INSERT INTO movement_evidence(entity_id,movement_id,evidence_id) VALUES($1,$2,$3)', [id(1), id(n), id(4)])
    await db.query("UPDATE brand_movements SET status='published' WHERE id=$1", [id(n)])
  }
  await db.query("INSERT INTO brand_patterns(id,entity_id,title,description,window_start,window_end,confidence) VALUES($1,$2,'Direction','Two events','2026-01-01','2026-10-01',1)", [id(7), id(1)])
}
test('SQL dedup, alias normalization, retention and event independence constraints', async () => {
  const db = await database(); try {
    await seed(db)
    await assert.rejects(db.exec("UPDATE brand_evidence SET fact='Invented rewrite'"), /immutable/)
    await assert.rejects(db.exec("UPDATE brand_evidence SET review_status='pending'"), /not reset/)
    await assert.rejects(db.exec("UPDATE brand_movements SET event_key='same-event'"), /immutable/)
    await assert.rejects(db.exec("UPDATE source_items SET title='Rewritten source'"), /immutable/)
    await db.query("INSERT INTO brand_aliases(entity_id,alias,alias_type,language) VALUES($1,' ＴＯＳＳ ','official','en')", [id(1)])
    await assert.rejects(db.query("INSERT INTO brand_aliases(entity_id,alias,alias_type,language) VALUES($1,'toss','official','en')", [id(1)]), /unique/)
    await assert.rejects(db.exec("INSERT INTO source_items(provider_id,canonical_url,original_url,title,date_precision,content_hash) SELECT provider_id,canonical_url,original_url,title,date_precision,content_hash FROM source_items"), /unique/)
    await assert.rejects(db.exec("UPDATE source_items SET raw_text='copyright content'"), /check constraint/)
    await db.query('INSERT INTO pattern_movements(entity_id,pattern_id,movement_id) VALUES($1,$2,$3)', [id(1), id(7), id(5)])
    await assert.rejects(db.query("UPDATE brand_patterns SET status='published' WHERE id=$1", [id(7)]), /two independent/)
  } finally { await db.close() }
})
test('SQL publication checks full take lineage and freezes published snapshot revisions and junctions', async () => {
  const db = await database(); try {
    await seed(db)
    for (const n of [5, 6]) await db.query('INSERT INTO pattern_movements(entity_id,pattern_id,movement_id) VALUES($1,$2,$3)', [id(1), id(7), id(n)])
    await db.query("UPDATE brand_patterns SET status='published' WHERE id=$1", [id(7)])
    await assert.rejects(db.query("UPDATE brand_patterns SET description='Rewrite' WHERE id=$1", [id(7)]), /immutable/)
    await assert.rejects(db.query('DELETE FROM pattern_movements WHERE pattern_id=$1', [id(7)]), /immutable/)
    await db.query("INSERT INTO brand_takes(id,entity_id,pattern_id,what_we_see,why_it_may_matter,what_to_watch_next) VALUES($1,$2,$3,'Observation','Interpretation','Next')", [id(8), id(1), id(7)])
    await assert.rejects(db.query("UPDATE brand_takes SET status='published' WHERE id=$1", [id(8)]), /reachable/)
    await db.query('INSERT INTO take_evidence(entity_id,take_id,evidence_id) VALUES($1,$2,$3)', [id(1), id(8), id(4)])
    await db.query("UPDATE brand_takes SET status='published' WHERE id=$1", [id(8)])
    // Deferred validation must inspect the final row, not the earlier INSERT image.
    await db.exec('BEGIN')
    await db.query("INSERT INTO brand_snapshots(id,entity_id,headline,body,valid_from,evidence_count,source_count,reviewed_by,reviewed_at) VALUES($1,$2,'Direction','Body',now(),0,0,'editor',now())", [id(11), id(1)])
    await db.query('INSERT INTO snapshot_takes(entity_id,snapshot_id,take_id) VALUES($1,$2,$3)', [id(1), id(11), id(8)])
    await db.query("UPDATE brand_snapshots SET evidence_count=1,source_count=1,status='published' WHERE id=$1", [id(11)])
    await db.exec('COMMIT')
    await db.query("INSERT INTO brand_snapshots(id,entity_id,headline,body,valid_from,evidence_count,source_count,reviewed_by,reviewed_at) VALUES($1,$2,'Direction','Body',now(),1,1,'editor',now())", [id(9), id(1)])
    await db.query('INSERT INTO snapshot_takes(entity_id,snapshot_id,take_id) VALUES($1,$2,$3)', [id(1), id(9), id(8)])
    await db.query('UPDATE brand_snapshots SET source_count=2 WHERE id=$1', [id(9)])
    await assert.rejects(db.query("UPDATE brand_snapshots SET status='published' WHERE id=$1", [id(9)]), /coverage counts/)
    await db.query('UPDATE brand_snapshots SET source_count=1 WHERE id=$1', [id(9)])
    await db.query("UPDATE brand_snapshots SET status='published' WHERE id=$1", [id(9)])
    await assert.rejects(db.query("UPDATE brand_snapshots SET body='Rewrite' WHERE id=$1", [id(9)]), /immutable/)
    await assert.rejects(db.query('DELETE FROM brand_snapshots WHERE id=$1', [id(9)]), /history/)
    await db.query("INSERT INTO brand_snapshots(entity_id,headline,body,valid_from,evidence_count,source_count,revision,supersedes_id) VALUES($1,'Corrected','New body',now(),1,1,2,$2)", [id(1), id(9)])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM brand_snapshots')).rows[0].n, 3)
    await db.exec("INSERT INTO brand_watch_review_events(target_type,target_id,action,actor,reason) SELECT 'snapshot',id,'publish','editor','Approved' FROM brand_snapshots LIMIT 1")
    await assert.rejects(db.exec('DELETE FROM brand_watch_review_events'), /append-only/)
  } finally { await db.close() }
})
test('SQL mention cannot publish a movement and cross-entity links fail', async () => {
  const db = await database(); try {
    await seed(db)
    await db.exec("UPDATE source_entity_matches SET role='mentioned'")
    await db.query("INSERT INTO brand_movements(id,entity_id,event_key,title,summary,movement_type,scope,importance) VALUES($1,$2,'event-c','Event','Summary','campaign','national',1)", [id(10), id(1)])
    await db.query('INSERT INTO movement_evidence(entity_id,movement_id,evidence_id) VALUES($1,$2,$3)', [id(1), id(10), id(4)])
    await assert.rejects(db.query("UPDATE brand_movements SET status='published' WHERE id=$1", [id(10)]), /primary-action/)
    await assert.rejects(db.query('INSERT INTO pattern_movements(entity_id,pattern_id,movement_id) VALUES($1,$2,$3)', [id(99), id(7), id(5)]), /foreign key/)
  } finally { await db.close() }
})
