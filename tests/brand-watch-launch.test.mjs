import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

// Chapter 7: real launch dataset through the full lifecycle on PGlite (migrations 018–022). Never production.
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
const { createElement } = require('react')
const stubs = {
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => createElement('a', { href, ...rest }, children) },
  'next/navigation': { useRouter: () => ({ refresh() {} }), usePathname: () => '/admin/brand-watch' },
}
function resolve(from, key) {
  const base = key.startsWith('@/') ? path.resolve('src', key.slice(2)) : path.resolve(path.dirname(from), key)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base]) if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate
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
const dataset = load(root + 'launch/dataset.ts')
const { seedLaunchDataset, launchContentHash, launchCanonicalUrl } = load(root + 'launch/seed.ts')
const { executeReviewCommand } = load(root + 'review/commands.ts')
const { loadPublicBrandStates } = load(root + 'public/load.ts')
const { fetchPublicBrandRows } = load(root + 'public/queries.ts')
const { buildPublicBrandState, buildPublicBrandCard, PUBLIC_BRAND_SLUGS } = load(root + 'public/view.ts')
const { brandWatchSitemapEntries, brandsIndexMetadata } = load(root + 'public/metadata.ts')
const { loadLineageGraph } = load(root + 'lifecycle/load.ts')
const { evaluateLineageHealth } = load(root + 'lifecycle/health.ts')
const { countIndependence, movementOccurrence } = load(root + 'patterns/eligibility.ts')
const { evaluateEligibility } = load(root + 'schemas.ts')
const { detectEntityCandidates, relevanceCandidate } = load(root + 'sources/candidates.ts')
const { fetchBrandWatchAdminRows } = load(root + 'admin/queries.ts')
const { buildAdminView } = load(root + 'admin/view.ts')
const { handleAdminReviewRequest } = load(root + 'admin/actions.ts')
const { revalidateBrandWatchPublic, publicRevalidationTarget } = load(root + 'admin/revalidate.ts')
const { renderToStaticMarkup } = require('react-dom/server')
const BrandDossier = load('src/components/brand-watch/BrandDossier.tsx').default
const BrandIndex = load('src/components/brand-watch/BrandIndex.tsx').default
const migrations = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle', '021_brand_watch_analysis_review_commands', '022_brand_watch_meaningful_update'].map(name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))

const NOW = '2026-10-14T12:00:00Z', ACTOR = 'admin:launch-review@marklens.test'
const entity = slug => launchRegistry.find(row => row.slug === slug).entity.id
const lid = n => `c7000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ---------- PGlite harness (tests only) ----------
async function database() {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE articles(id uuid PRIMARY KEY, title text, status text NOT NULL DEFAULT 'pending');
    CREATE TABLE insights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid UNIQUE REFERENCES articles(id), slug text NOT NULL, hook text);
    GRANT SELECT ON articles, insights TO service_role;`)
  for (const sql of migrations) await db.exec(sql)
  return db
}
const asService = async (db, fn) => { await db.exec('SET ROLE service_role'); try { return await fn() } finally { await db.exec('RESET ROLE') } }
const seedClient = db => ({
  async rpc(fn, args) {
    const keys = Object.keys(args)
    return asService(db, async () => {
      try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
      catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
    })
  },
  async insert(table, row) { const keys = Object.keys(row); await asService(db, () => db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(row))) },
})
const queryClient = db => ({ from: table => ({ select: columns => {
  const state = { where: [], order: null, limit: null }
  const builder = {
    in(column, values) { state.where.push([column, values]); return builder },
    order(column, options = {}) { state.order = `${column} ${options.ascending === false ? 'DESC' : 'ASC'} NULLS ${options.nullsFirst ? 'FIRST' : 'LAST'}`; return builder },
    limit(count) { state.limit = count; return builder },
    then(resolve, reject) {
      const sql = `SELECT row_to_json(t) AS row FROM (SELECT ${columns} FROM ${table}${state.where.length ? ` WHERE ${state.where.map(([column], i) => `${column} = ANY($${i + 1})`).join(' AND ')}` : ''}${state.order ? ` ORDER BY ${state.order}` : ''}${state.limit ? ` LIMIT ${state.limit}` : ''}) t`
      return asService(db, async () => {
        try { return { data: (await db.query(sql, state.where.map(([, values]) => values))).rows.map(row => row.row), error: null } }
        catch (error) { return { data: null, error: { message: error.message } } }
      }).then(resolve, reject)
    },
  }
  return builder
} }) })
const review = async (db, command) => { const result = await executeReviewCommand(seedClient(db), { actor: ACTOR, ...command }); assert.equal(result.ok, true, `${command.command}: ${result.code}`); return result }
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]
const applyRecommendedProfiles = async db => { for (const row of dataset.launchProfileRecommendations) await db.query(`UPDATE brand_watch_profiles SET public_status=$2, seo_status=$3 WHERE entity_id=$1`, [entity(row.entity), row.publicStatus, row.seoStatus]) }
const seeded = async () => { const db = await database(); await seedLaunchDataset(seedClient(db), { actor: ACTOR }); return db }
const states = db => loadPublicBrandStates(() => queryClient(db), PUBLIC_BRAND_SLUGS, NOW)
const bySlug = (list, slug) => list.find(state => state.brand.slug === slug)

// Per-brand counts computed from the database itself (used by the final report).
async function brandReport(db, slug) {
  const id = entity(slug)
  const count = async (sql) => Number((await one(db, sql, [id])).n)
  const graph = await loadLineageGraph(queryClient(db), id)
  const published = graph.movements.filter(row => row.status === 'published')
  const cutoff = new Date(Date.parse(NOW) - 90 * 86400000).toISOString().slice(0, 10)
  const providers = new Set(published.flatMap(row => row.evidence.map(e => e.source.providerId)))
  const profile = await one(db, 'SELECT last_meaningful_update_at FROM brand_watch_profiles WHERE entity_id=$1', [id])
  const takes = await count(`SELECT count(*) n FROM brand_takes WHERE entity_id=$1 AND status='published'`)
  const snapshot = await count(`SELECT count(*) n FROM brand_snapshots WHERE entity_id=$1 AND status='published'`)
  return {
    sources: await count(`SELECT count(DISTINCT s.id) n FROM source_items s JOIN source_entity_matches m ON m.source_item_id=s.id WHERE m.entity_id=$1`),
    evidenceApproved: await count(`SELECT count(*) n FROM brand_evidence WHERE entity_id=$1 AND review_status='approved' AND status='active'`),
    evidenceRejected: await count(`SELECT count(*) n FROM brand_evidence WHERE entity_id=$1 AND review_status='rejected'`),
    movements: published.length,
    patterns: await count(`SELECT count(*) n FROM brand_patterns WHERE entity_id=$1 AND status='published'`),
    takes, snapshot,
    providers: providers.size,
    // The meaningful-update stamp comes from the database clock at seed time, so eligibility uses the real clock.
    eligibility: evaluateEligibility({ recentMovementCount: published.filter(row => (movementOccurrence(row)?.occurredOn ?? '') >= cutoff).length, distinctSourceCount: providers.size, takeCount: takes, hasSnapshot: snapshot > 0, lastMeaningfulUpdateAt: profile?.last_meaningful_update_at ? new Date(profile.last_meaningful_update_at).toISOString() : null }, new Date()),
  }
}

test('1: five launch entities seed with registry identities; per-brand counts come from the database', async () => {
  const db = await seeded()
  try {
    const rows = (await db.query('SELECT id, slug FROM brand_entities ORDER BY slug')).rows
    assert.deepEqual(rows.map(row => [row.slug, row.id]), [...launchRegistry].sort((a, b) => a.slug.localeCompare(b.slug)).map(row => [row.slug, row.entity.id]))
    const report = Object.fromEntries(await Promise.all(PUBLIC_BRAND_SLUGS.map(async slug => [slug, await brandReport(db, slug)])))
    const pick = row => [row.sources, row.evidenceApproved, row.evidenceRejected, row.movements, row.patterns, row.takes, row.snapshot, row.providers, row.eligibility.publicCandidate, row.eligibility.seoCandidate]
    assert.deepEqual(pick(report.musinsa), [9, 8, 1, 4, 2, 2, 1, 6, true, true])
    assert.deepEqual(pick(report['olive-young']), [8, 9, 1, 5, 2, 2, 1, 2, true, false])
    assert.deepEqual(pick(report.toss), [7, 5, 1, 4, 1, 1, 0, 3, false, false])
    assert.deepEqual(pick(report.baemin), [8, 7, 1, 3, 1, 1, 0, 5, false, false])
    assert.deepEqual(pick(report.danggeun), [8, 7, 1, 5, 2, 2, 1, 2, true, false])
    // Recommended launch visibility is exactly what the eligibility rules compute.
    for (const row of dataset.launchProfileRecommendations) {
      assert.equal(row.publicStatus === 'published', report[row.entity].eligibility.publicCandidate, row.entity)
      assert.equal(row.seoStatus === 'index', report[row.entity].eligibility.seoCandidate, row.entity)
    }
    console.log('LAUNCH_REPORT ' + JSON.stringify(report))
  } finally { await db.close() }
})

test('2/15: Source → Evidence lineage is traceable; sources store title/link/date only and DTOs never carry bodies', async () => {
  const db = await seeded()
  try {
    const sources = (await db.query('SELECT id, title, canonical_url, original_url, published_at, date_precision, content_hash, raw_text, raw_html, image_url, rights_basis FROM source_items')).rows
    assert.equal(sources.length, dataset.launchSources.length)
    for (const row of sources) {
      const source = dataset.launchSources.find(item => item.id === row.id)
      assert.deepEqual([row.raw_text, row.raw_html, row.image_url, row.rights_basis], [null, null, null, null], row.title)
      assert.match(row.canonical_url, /^https:\/\//)
      assert.equal(row.canonical_url, launchCanonicalUrl(source.url))
      assert.equal(row.content_hash, launchContentHash(source.title, source.url))
      assert.equal(row.published_at === null, source.datePrecision === 'unknown', row.title)
    }
    for (const item of dataset.launchEvidence) {
      const row = await one(db, 'SELECT e.review_status, e.status, e.support_text, e.source_item_id, e.date_precision FROM brand_evidence e WHERE e.id=$1', [item.id])
      assert.equal(row.review_status, item.decision.action === 'approve' ? 'approved' : 'rejected', item.id)
      assert.ok(item.supportText.length > 0 && item.supportText.length <= 200, `support span is a short quote: ${item.id}`)
      assert.ok(item.fact.length <= 300 && !/\n/.test(item.fact), item.id)
      assert.equal(item.eventDate === null, item.datePrecision === 'unknown', item.id)
      assert.ok(sources.some(source => source.id === row.source_item_id))
    }
    // Month precision and unknown publication date both occur in the real data.
    assert.ok(dataset.launchEvidence.some(item => item.datePrecision === 'month'))
    assert.ok(dataset.launchSources.some(item => item.datePrecision === 'unknown'))
    await applyRecommendedProfiles(db)
    const json = JSON.stringify(await states(db))
    // Support quotes stay internal; a quote that is the source headline is public anyway as the source title.
    for (const item of dataset.launchEvidence.filter(row => !dataset.launchSources.some(source => source.title.includes(row.supportText)))) assert.ok(!json.includes(item.supportText), `support quote never public: ${item.id}`)
    assert.doesNotMatch(json, /raw_text|raw_html|support_text|supportText|reliability|Attribution only/)
  } finally { await db.close() }
})

test('3: several reports of one event stay one Movement; a second Movement for the same event key is refused', async () => {
  const db = await seeded()
  try {
    const links = async movement => (await db.query('SELECT e.source_item_id FROM movement_evidence me JOIN brand_evidence e ON e.id=me.evidence_id WHERE me.movement_id=$1', [lid(movement)])).rows.map(row => row.source_item_id).sort()
    assert.deepEqual(await links(402), [lid(203), lid(204)]) // two official releases of the Sanrio campaign
    assert.deepEqual(await links(441), [lid(241), lid(242), lid(243)]) // 당근절 announcement, media, results
    assert.deepEqual(await links(414), [lid(214), lid(215), lid(219)]) // On & Off Festival: two outlets + the official release
    assert.deepEqual(await links(401), [lid(201), lid(202)]) // Festa LA: official + independent media
    await assert.rejects(seedClient(db).insert('brand_movements', { id: lid(499), entity_id: entity('danggeun'), event_key: 'danggeun-danggeunjeol-2026', title: '당근절 중복', summary: 'dup', movement_type: 'promotion', scope: 'national', importance: 1 }), /duplicate key|unique/)
    await applyRecommendedProfiles(db)
    const danggeun = bySlug(await states(db), 'danggeun')
    assert.equal(danggeun.movements.filter(row => /당근절/.test(row.title)).length, 1)
    assert.deepEqual([danggeun.movements.find(row => /당근절/.test(row.title)).sourceRefs.length, danggeun.movements.find(row => /당근절/.test(row.title)).providerCount], [3, 2])
  } finally { await db.close() }
})

test('4: entity boundaries — related brands, subsidiaries, corporate-only and hiring items never become core actions', async () => {
  // The deterministic matcher only proposes mentions; these titles really do contain a core alias.
  assert.deepEqual(detectEntityCandidates('무신사 29CM, 이구홈 서울숲 오픈', '').map(row => [row.entityId, row.roleCandidate]), [[entity('musinsa'), 'mentioned']])
  assert.deepEqual(detectEntityCandidates("토스플레이스, '찾아가는 토스플레이스' 첫 간담회", '').map(row => [row.entityId, row.roleCandidate]), [[entity('toss'), 'mentioned']])
  assert.deepEqual(detectEntityCandidates('당근부동산, ‘살아본 후기 지도’ 기능 출시', '').map(row => row.entityId), [entity('danggeun')])
  assert.equal(relevanceCandidate('CJ올리브영, ’26 하반기 신입사원 채용', '').excludeReasons.includes('채용'), true)
  const db = await seeded()
  try {
    for (const [evidence, slug] of [[316, 'musinsa'], [326, 'toss'], [336, 'baemin'], [348, 'danggeun'], [310, 'olive-young']]) {
      const row = await one(db, `SELECT e.review_status, m.role, m.review_status AS match_status FROM brand_evidence e JOIN source_entity_matches m ON m.source_item_id=e.source_item_id AND m.entity_id=e.entity_id WHERE e.id=$1`, [lid(evidence)])
      assert.deepEqual([row.review_status, row.role, row.match_status], ['rejected', 'mentioned', 'pending'], slug)
      const reason = await one(db, `SELECT reason, actor FROM brand_watch_review_events WHERE target_id=$1 AND action='reject'`, [lid(evidence)])
      assert.ok(reason.reason.length > 10 && reason.actor === ACTOR)
    }
    // Toss Place × 당근: a DANGGEUN action; TOSS keeps only a pending mention.
    const matches = (await db.query('SELECT entity_id, role, review_status FROM source_entity_matches WHERE source_item_id=$1 ORDER BY role', [lid(247)])).rows
    assert.deepEqual(matches.map(row => [row.entity_id, row.role, row.review_status]), [[entity('toss'), 'mentioned', 'pending'], [entity('danggeun'), 'primary', 'approved']])
    await db.query(`UPDATE brand_watch_profiles SET public_status='published'`)
    const list = await states(db)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'toss')), /토스플레이스|40만/)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'musinsa')), /29CM|이구홈/)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'baemin')), /테크콘퍼런스/)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'danggeun')), /당근부동산|후기 지도/)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'olive-young')), /신입사원|채용/)
  } finally { await db.close() }
})

test('5/6/7: Pattern independence, Take reachability and Snapshot coverage hold on the real lineage', async () => {
  const db = await seeded()
  try {
    for (const slug of PUBLIC_BRAND_SLUGS) {
      const graph = await loadLineageGraph(queryClient(db), entity(slug))
      const report = evaluateLineageHealth(graph, NOW)
      assert.deepEqual(report.summary, { HEALTHY: report.results.length, STALE: 0, REVIEW_REQUIRED: 0, BROKEN: 0 }, slug)
      for (const pattern of graph.patterns) {
        const entries = pattern.movementIds.map(id => { const movement = graph.movements.find(row => row.id === id); return { movement, ...movementOccurrence(movement) } })
        assert.ok(countIndependence(entries, { minIndependentMovements: 2, recencyDays: 90, sameEventTitleSimilarity: 0.85, sameEventMaxDayDistance: 7, duplicateOverlap: 0.5 }).independentMovementCount >= 2, pattern.title)
        // The stored window equals the reviewed observation days of its Movements.
        const days = entries.map(row => row.occurredOn).sort()
        assert.deepEqual([pattern.windowStart, pattern.windowEnd], [days[0], days.at(-1)], pattern.title)
      }
      for (const take of graph.takes) {
        const pattern = graph.patterns.find(row => row.id === take.patternId)
        const reachable = new Set(pattern.movementIds.flatMap(id => graph.movements.find(row => row.id === id).evidence.map(e => e.id)))
        assert.ok(take.evidenceIds.every(id => reachable.has(id)), take.id)
      }
      for (const snapshot of graph.snapshots) {
        const evidence = new Set(graph.takes.filter(row => snapshot.takeIds.includes(row.id)).flatMap(row => row.evidenceIds))
        const sources = new Set(graph.movements.flatMap(row => row.evidence).filter(e => evidence.has(e.id)).map(e => e.sourceItemId))
        assert.deepEqual([snapshot.evidenceCount, snapshot.sourceCount], [evidence.size, sources.size], slug)
      }
    }
    // The real save/publish guards refuse broken attempts.
    const client = seedClient(db)
    const save = (fn, args) => client.rpc(fn, { p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: NOW, p_confidence: 0.5, p_uncertainties: [], p_revision: 1, p_supersedes_id: null, ...args })
    assert.match((await save('brand_watch_save_pattern_draft', { p_id: lid(590), p_entity_id: entity('musinsa'), p_title: 'one', p_description: 'one', p_window_start: '2026-08-21', p_window_end: '2026-08-21', p_movement_ids: [lid(412)] })).error.message, /LINEAGE_REQUIRED/)
    assert.match((await save('brand_watch_save_take_draft', { p_id: lid(690), p_entity_id: entity('musinsa'), p_pattern_id: lid(511), p_what_we_see: 'x', p_why_it_may_matter: 'x', p_what_to_watch_next: 'x', p_evidence_ids: [lid(311)] })).error.message, /INELIGIBLE_LINEAGE/)
    assert.match((await save('brand_watch_save_snapshot_draft', { p_id: lid(790), p_entity_id: entity('toss'), p_headline: 'x', p_body: 'x', p_watch_next: null, p_valid_from: NOW, p_evidence_count: 1, p_source_count: 1, p_take_ids: [lid(621)] })).error.message, /COVERAGE_COUNT_MISMATCH/)
  } finally { await db.close() }
})

test('8: Snapshot revision switches the current pointer; history is kept and public reads only the current one', async () => {
  const db = await seeded()
  try {
    await applyRecommendedProfiles(db)
    const before = bySlug(await states(db), 'olive-young')
    assert.equal(before.snapshot.headline, '국내 체험형 접점과 해외 소비자 접점을 함께 넓히는 중')
    const client = seedClient(db)
    const v2 = { p_id: lid(702), p_entity_id: entity('olive-young'), p_headline: '해외 유통 채널과 국내 체험형 접점을 함께 넓히는 중', p_body: '세포라 입점 이후 해외 유통 채널과 국내 체험형 접점을 함께 넓히는 흐름이 이어진다.', p_watch_next: '세포라 입점 국가의 확대 여부.', p_valid_from: '2026-10-12T00:00:00+09:00', p_evidence_count: 6, p_source_count: 5, p_confidence: 0.6, p_uncertainties: [], p_revision: 2, p_supersedes_id: lid(701), p_take_ids: [lid(601), lid(602)], p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: NOW }
    assert.equal((await client.rpc('brand_watch_save_snapshot_draft', v2)).error, null)
    const published = await review(db, { command: 'snapshot.publish', snapshotId: lid(702), reason: 'Revision reviewed.' })
    assert.deepEqual([published.result.previousCurrentSnapshotId, published.result.supersededId], [lid(701), lid(701)])
    const rows = (await db.query(`SELECT id, status, revision FROM brand_snapshots WHERE entity_id=$1 ORDER BY revision`, [entity('olive-young')])).rows
    assert.deepEqual(rows.map(row => [row.id, row.status, row.revision]), [[lid(701), 'superseded', 1], [lid(702), 'published', 2]])
    assert.equal((await one(db, 'SELECT current_snapshot_id FROM brand_watch_profiles WHERE entity_id=$1', [entity('olive-young')])).current_snapshot_id, lid(702))
    assert.deepEqual((await db.query(`SELECT action FROM brand_watch_review_events WHERE target_id=$1 ORDER BY occurred_at,action`, [lid(701)])).rows.map(row => row.action), ['publish', 'supersede'])
    const after = bySlug(await states(db), 'olive-young')
    assert.equal(after.snapshot.headline, v2.p_headline)
    assert.doesNotMatch(JSON.stringify(after), /국내 체험형 접점과 해외 소비자 접점을 함께 넓히는 중/)
  } finally { await db.close() }
})

test('9/10: a real correction propagates — review-required facts, stale analysis, public exclusion, human remediation; meaningful-update timestamps', async () => {
  const db = await seeded()
  try {
    await db.query(`UPDATE brand_watch_profiles SET public_status='published'`)
    const baemin = entity('baemin')
    const stamp = async () => (await one(db, 'SELECT last_meaningful_update_at AS t FROM brand_watch_profiles WHERE entity_id=$1', [baemin])).t
    const t0 = await stamp()
    assert.ok(t0, 'publishing set the timestamp')
    // Non-meaningful activity: reads, source collection, a pending Evidence and its approval, a draft and its rejection.
    const club = row => row.title === "포인트 적립형 '배민클럽 에디션2' 출시"
    // Visual evidence follows lineage: the club Movement shows the official 우아한형제들 release image before correction.
    assert.match(bySlug(await states(db), 'baemin').movements.find(club).visual.src, /woowahan-cdn\.woowahan\.com\/new_resources\/image\/report\/1ace38b39cf74c10a253e04e5daf81ab/)
    await seedClient(db).insert('source_items', { id: lid(299), provider_id: lid(107), canonical_url: 'https://www.newspim.com/news/view/0', original_url: 'https://www.newspim.com/news/view/0', title: '수집만 된 소스', date_precision: 'unknown', content_hash: 'f'.repeat(64) })
    await seedClient(db).insert('source_entity_matches', { source_item_id: lid(299), entity_id: baemin, role: 'mentioned', confidence: 0.5, method: 'manual', review_status: 'pending' })
    await seedClient(db).insert('brand_evidence', { id: lid(399), entity_id: baemin, source_item_id: lid(299), fact: '검수 대기 사실', support_text: '검수 대기', date_precision: 'unknown', marketing_relevance: 1, confidence: 0.5, extraction_method: 'manual' })
    await review(db, { command: 'evidence.approve', evidenceId: lid(399), matchRole: 'primary', reason: 'Checked.' })
    await seedClient(db).insert('brand_movements', { id: lid(498), entity_id: baemin, event_key: 'baemin-draft-only', title: '초안', summary: '초안', movement_type: 'product', scope: 'national', importance: 1 })
    await seedClient(db).insert('movement_evidence', { entity_id: baemin, movement_id: lid(498), evidence_id: lid(399) })
    await review(db, { command: 'movement.reject', movementId: lid(498), reason: 'Not a marketing move.' })
    assert.equal((await stamp()).getTime(), t0.getTime(), 'reads, collection, pending review and draft rejection are not meaningful')

    // Correction: the announced-plan fact is superseded by the confirmed launch (HuffPost Korea: '1일 배민클럽 에디션2를 출시했다').
    const corrected = await review(db, { command: 'evidence.supersede', evidenceId: lid(331), reason: '출시 예정 발표를 실제 출시 보도로 교정', successor: { sourceItemId: lid(232), fact: '우아한형제들은 2026년 10월 1일 배민클럽 에디션2를 출시했다.', supportText: "배달의민족 운영사 우아한형제들은 1일 '배민클럽 에디션2'를 출시했다.", supportLocator: null, eventDate: '2026-10-01', datePrecision: 'day', marketingRelevance: 1, confidence: 0.9 } })
    const t1 = await stamp()
    assert.ok(t1.getTime() >= t0.getTime(), 'Evidence correction behind a published Movement is meaningful')
    const health = evaluateLineageHealth(await loadLineageGraph(queryClient(db), baemin), NOW)
    const status = (kind, n) => health.results.find(row => row.kind === kind && row.id === lid(n)).health
    assert.deepEqual([status('movement', 431), status('pattern', 531), status('take', 631), status('movement', 433)], ['REVIEW_REQUIRED', 'STALE', 'STALE', 'HEALTHY'])
    const admin = buildAdminView((await fetchBrandWatchAdminRows(queryClient(db))).rows, NOW)
    assert.equal(admin.movements.find(row => row.id === lid(431)).health.health, 'REVIEW_REQUIRED')
    let state = bySlug(await states(db), 'baemin')
    assert.deepEqual([state.movements.map(row => row.title).sort(), state.patterns, state.takes], [['서울시와 \'9월말 투아웃\' 픽업 캠페인', '장보기·쇼핑에 뷰티 판매점 오프뷰티 입점'], [], []])
    // The corrected Movement's image is withheld with it; unaffected Movements keep theirs.
    assert.doesNotMatch(JSON.stringify(state), /1ace38b39cf74c10a253e04e5daf81ab/)
    assert.ok(state.movements.every(row => row.visual))

    // Human remediation — nothing regenerates automatically.
    const successor = corrected.result.successorId ?? (await one(db, 'SELECT id FROM brand_evidence WHERE supersedes_id=$1', [lid(331)])).id
    await review(db, { command: 'evidence.approve', evidenceId: successor, matchRole: 'primary', reason: '실제 출시 보도 확인' })
    const superseded = await review(db, { command: 'movement.supersede', movementId: lid(431), reason: '교정된 Evidence로 Movement 갱신', successor: { eventKey: 'baemin-club-edition-2-launched', title: "포인트 적립형 '배민클럽 에디션2' 출시", summary: '10월 1일 결제 금액에 따라 배민포인트를 적립하는 배민클럽 신규 상품을 출시했다. 적립은 음식 배달뿐 아니라 픽업과 장보기·쇼핑 결제에도 적용된다.', movementType: 'product', scope: 'national', market: ['KR'], channel: ['online'], startedAt: null, lastObservedAt: '2026-10-01T00:00:00+09:00', importance: 3, evidenceIds: [successor, lid(332), lid(337)] } })
    const newMovement = superseded.result.successorId ?? (await one(db, `SELECT id FROM brand_movements WHERE event_key='baemin-club-edition-2-launched'`)).id
    await review(db, { command: 'movement.approve', movementId: newMovement, reason: 'Corrected lineage reviewed.' })
    const client = seedClient(db), extra = { p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: NOW, p_confidence: 0.6, p_uncertainties: [] }
    assert.equal((await client.rpc('brand_watch_save_pattern_draft', { ...extra, p_id: lid(532), p_entity_id: baemin, p_title: dataset.launchPatterns.find(row => row.id === lid(531)).title, p_description: dataset.launchPatterns.find(row => row.id === lid(531)).description, p_window_start: '2026-10-01', p_window_end: '2026-10-08', p_revision: 2, p_supersedes_id: lid(531), p_movement_ids: [newMovement, lid(433)] })).error, null)
    await review(db, { command: 'pattern.publish', patternId: lid(532), reason: 'Revision reviewed.' })
    const take = dataset.launchTakes.find(row => row.id === lid(631))
    assert.equal((await client.rpc('brand_watch_save_take_draft', { ...extra, p_id: lid(632), p_entity_id: baemin, p_pattern_id: lid(532), p_what_we_see: take.whatWeSee, p_why_it_may_matter: take.whyItMayMatter, p_what_to_watch_next: take.whatToWatchNext, p_revision: 1, p_supersedes_id: null, p_evidence_ids: [successor, lid(332), lid(335)] })).error, null)
    await review(db, { command: 'take.publish', takeId: lid(632), reason: 'Reviewed against corrected lineage.' })
    assert.ok((await stamp()).getTime() >= t1.getTime())
    state = bySlug(await states(db), 'baemin')
    assert.deepEqual([state.patterns.length, state.takes.length, state.movements.length], [1, 1, 3])
    assert.match(JSON.stringify(state), /2026년 10월 1일 배민클럽 에디션2를 출시했다/)
    assert.doesNotMatch(JSON.stringify(state), /출시한다고 밝혔다/)
    // After human remediation the image returns only through the re-reviewed lineage (official release); media copies never show.
    assert.match(state.movements.find(club).visual.src, /woowahan-cdn\.woowahan\.com\/new_resources\/image\/report\/1ace38b39cf74c10a253e04e5daf81ab/)
    assert.doesNotMatch(JSON.stringify(state), /huffingtonpost\.kr\/news\/photo|img\.newspim\.com|image\.newdaily|cdn\.pointdaily/)
    // History stays: the superseded rows and their events remain.
    assert.deepEqual((await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [lid(431)])).status, 'superseded')
    assert.deepEqual((await one(db, 'SELECT status FROM brand_patterns WHERE id=$1', [lid(531)])).status, 'superseded')
  } finally { await db.close() }
})

test('11: successful public-impacting commands revalidate only /brands and the affected brand page', async () => {
  const db = await seeded()
  try {
    const run = async command => { const paths = []; const result = await revalidateBrandWatchPublic(queryClient(db), command, path => paths.push(path)); assert.deepEqual(result, paths); return paths }
    assert.deepEqual(await run({ command: 'pattern.publish', patternId: lid(501) }), ['/brands', '/brands/olive-young'])
    assert.deepEqual(await run({ command: 'snapshot.publish', snapshotId: lid(711) }), ['/brands', '/brands/musinsa'])
    assert.deepEqual(await run({ command: 'evidence.supersede', evidenceId: lid(343) }), ['/brands', '/brands/danggeun'])
    assert.deepEqual(await run({ command: 'movement.merge', sourceMovementId: lid(423), targetMovementId: lid(422) }), ['/brands', '/brands/toss'])
    for (const command of [{ command: 'evidence.approve', evidenceId: lid(301) }, { command: 'evidence.reject', evidenceId: lid(316) }, { command: 'movement.reject', movementId: lid(401) }, { command: 'pattern.reject', patternId: lid(501) }, { command: 'snapshot.publish', snapshotId: lid(999) }]) assert.deepEqual(await run(command), [], command.command)
    assert.equal(publicRevalidationTarget({ command: 'take.publish', takeId: 42 }), null)
    // Wired through the admin handler: only after success, and a revalidation failure never fails the review.
    let calls = 0
    const ok = await handleAdminReviewRequest({ command: { command: 'pattern.reject', patternId: lid(999), reason: 'x' } }, { actor: ACTOR, client: () => seedClient(db), onSuccess: async () => { calls++ } })
    assert.deepEqual([ok.status, calls], [409, 0])
    await seedClient(db).insert('brand_patterns', { id: lid(598), entity_id: entity('toss'), title: 'draft', description: 'draft', window_start: '2026-08-14', window_end: '2026-09-27', confidence: 0.5 })
    const rejected = await handleAdminReviewRequest({ command: { command: 'pattern.reject', patternId: lid(598), reason: 'x' } }, { actor: ACTOR, client: () => seedClient(db), onSuccess: async () => { calls++; throw new Error('revalidate failed') } })
    assert.deepEqual([rejected.status, calls], [200, 1])
    const route = readFileSync('src/app/api/admin/brand-watch/review/route.ts', 'utf8')
    assert.match(route, /onSuccess: command => revalidateBrandWatchPublic\(/); assert.doesNotMatch(route, /revalidatePath\("\/"\)|revalidateTag/)
  } finally { await db.close() }
})

test('12: sitemap lists /brands whenever Brand Watch loads and brand pages only when SEO-indexable', async () => {
  const db = await seeded()
  try {
    // All profiles private: the directory is listed and indexable; no brand page is.
    assert.deepEqual(brandWatchSitemapEntries(await states(db), 'https://marklens.site').map(row => row.url), ['https://marklens.site/brands'])
    assert.equal(brandsIndexMetadata(await states(db)).robots, undefined)
    await applyRecommendedProfiles(db)
    const entries = brandWatchSitemapEntries(await states(db), 'https://marklens.site')
    assert.deepEqual(entries.map(row => row.url), ['https://marklens.site/brands', 'https://marklens.site/brands/musinsa'])
    assert.ok(entries.every(row => row.lastModified instanceof Date && !Number.isNaN(row.lastModified.getTime())))
    // Public but noindex (OLIVE YOUNG, DANGGEUN) and private (TOSS, BAEMIN) brand pages are never listed.
    assert.ok(!entries.some(row => /olive-young|danggeun|toss|baemin/.test(row.url)))
    // A failed load lists nothing and the directory is noindex.
    const failed = PUBLIC_BRAND_SLUGS.map(slug => ({ kind: 'error', brand: { slug } }))
    assert.deepEqual(brandWatchSitemapEntries(failed, 'https://marklens.site'), [])
    assert.deepEqual(brandsIndexMetadata(failed).robots, { index: false, follow: true })
    const sitemap = readFileSync('src/app/sitemap.ts', 'utf8')
    assert.match(sitemap, /brandWatchSitemapEntries\(await loadPublicBrandStates/)
    const nav = readFileSync('src/components/layout/navigation.ts', 'utf8')
    // IA V1 menu (Chapter B); the rendered menu is checked in tests/site-regressions.test.mjs.
    assert.deepEqual([...nav.matchAll(/\{ href: "([^"]+)", label: "([^"]+)"/g)].map(match => [match[2], match[1]]), [['Insights', '/insights'], ['Brand Watch', '/brands'], ['Career Lab', '/practice'], ['Dictionary', '/glossary'], ['Weekly', '/newsletter']])
  } finally { await db.close() }
})

test('13/14: full Source → Public E2E on real data; FACT / PATTERN / TAKE / Sources traceable; no private or draft leakage', async () => {
  const db = await seeded()
  try {
    await applyRecommendedProfiles(db)
    // Unreviewed material that must stay out.
    await seedClient(db).insert('brand_movements', { id: lid(497), entity_id: entity('olive-young'), event_key: 'olive-young-draft', title: 'DRAFT 올리브영 움직임', summary: 'draft', movement_type: 'promotion', scope: 'national', importance: 1 })
    const list = await states(db)
    assert.deepEqual(list.map(state => [state.brand.slug, state.kind]), [['musinsa', 'available'], ['olive-young', 'available'], ['toss', 'unavailable'], ['baemin', 'unavailable'], ['danggeun', 'available']])
    const oy = bySlug(list, 'olive-young')
    // Snapshot → Take → Pattern → Movement → Source, all resolvable within the page.
    const anchors = new Set([...oy.movements.map(row => row.anchor), ...oy.patterns.map(row => row.anchor), ...oy.takes.map(row => row.anchor)])
    for (const take of oy.snapshot.takeAnchors) assert.ok(anchors.has(take.anchor))
    for (const take of oy.takes) assert.ok(anchors.has(take.pattern.anchor))
    for (const pattern of oy.patterns) assert.ok(pattern.movementAnchors.every(row => anchors.has(row.anchor)))
    const refs = new Set(oy.sources.map(row => row.ref))
    for (const movement of oy.movements) assert.ok(movement.sourceRefs.length && movement.sourceRefs.every(ref => refs.has(ref)))
    const urls = oy.sources.map(row => row.url)
    for (const source of dataset.launchSources.filter(row => row.matches[0].entity === 'olive-young' && row.id !== lid(208))) assert.ok(urls.includes(launchCanonicalUrl(source.url)), source.title)
    assert.deepEqual([oy.movements.length, oy.patterns.length, oy.takes.length, oy.sources.length, oy.snapshot.evidenceCount, oy.snapshot.sourceCount], [5, 2, 2, 7, 6, 5])
    // Month precision and multi-source Movements render as such.
    const sanrio = oy.movements.find(row => /산리오/.test(row.title))
    assert.ok(sanrio.facts.some(fact => fact.date?.precision === 'month'))
    const html = renderToStaticMarkup(createElement(BrandDossier, { state: oy }))
    assert.match(html, /bw-label-fact">FACT</); assert.match(html, /bw-label-pattern">OBSERVED PATTERN</); assert.match(html, /bw-label-take">MARKLENS TAKE</)
    assert.match(html, /href="https:\/\/corp\.oliveyoung\.com\/ko\/newsroom\/press\/288" target="_blank" rel="noopener noreferrer"/)
    assert.match(html, /2026\.09<\/time>/)
    const musinsa = bySlug(list, 'musinsa')
    assert.ok(musinsa.movements.find(row => /로블록스/.test(row.title)).facts.length === 1)
    assert.equal(musinsa.sources.find(row => /로블록스/.test(row.title)).publishedAt, null) // unknown publication date stays unknown
    const indexHtml = renderToStaticMarkup(createElement(BrandIndex, { cards: list.map(buildPublicBrandCard) }))
    assert.match(indexHtml, /국내 체험형 접점과 해외 소비자 접점을 함께 넓히는 중/)
    assert.equal((indexHtml.match(/아직 공개된 Brand Watch 데이터가 없습니다/g) ?? []).length, 2)
    const json = JSON.stringify(list) + html + indexHtml
    // 토스플레이스 legitimately appears in DANGGEUN's partnership Movement; its exclusion from TOSS is checked in test 4.
    assert.doesNotMatch(json, /DRAFT|29CM|찾아가는 토스플레이스|테크콘퍼런스|당근부동산|신입사원|launch-review@|MarkLens의 해석이며 회사가 밝힌 목표가 아니다|관찰 기간이 3주|주체·날짜·지지 문장|Attribution only/)
    assert.doesNotMatch(json, /Score|\/100|HEALTHY|REVIEW_REQUIRED/)
    // Private brands' published analysis exists in the database but is not public.
    assert.equal((await one(db, `SELECT count(*)::int n FROM brand_takes WHERE entity_id=$1 AND status='published'`, [entity('toss')])).n, 1)
    assert.doesNotMatch(JSON.stringify(bySlug(list, 'toss')), /앱인토스/)
  } finally { await db.close() }
})

test('022 is repeat-safe, deferred, and not callable by anon/authenticated', async () => {
  const db = await database()
  try {
    await db.exec(migrations.at(-1))
    const triggers = (await db.query(`SELECT c.relname, t.tgdeferrable, t.tginitdeferred FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='bw_meaningful_update' ORDER BY c.relname`)).rows
    assert.deepEqual(triggers.map(row => [row.relname, row.tgdeferrable, row.tginitdeferred]), ['brand_evidence', 'brand_movements', 'brand_patterns', 'brand_snapshots', 'brand_takes'].map(name => [name, true, true]))
    for (const role of ['anon', 'authenticated']) assert.equal((await one(db, `SELECT has_function_privilege($1, 'public.brand_watch_mark_meaningful_update()', 'EXECUTE') AS ok`, [role])).ok, false, role)
  } finally { await db.close() }
})

test('copyright/provenance: dataset holds no article bodies; every fact cites one source; analysis is original and hedged', () => {
  for (const item of dataset.launchEvidence) {
    assert.ok(dataset.launchSources.some(source => source.id === item.sourceId))
    assert.ok(item.supportText.length <= 200)
  }
  for (const movement of dataset.launchMovements) assert.ok(movement.summary.length <= 600 && movement.evidenceIds.length >= 1)
  for (const take of dataset.launchTakes) {
    assert.match(take.whyItMayMatter, /수 있|볼 수 있|주목할 만하다/)
    assert.match(take.whatToWatchNext, /지켜볼 만하다/)
    assert.doesNotMatch(take.whyItMayMatter + take.whatWeSee, /반드시|확실히|전략적 의도|노린다|매출이 늘|점유율/)
  }
  for (const source of dataset.launchSources) assert.match(source.url, /^https:\/\//)
  const raw = readFileSync('src/lib/brand-watch/launch/dataset.ts', 'utf8')
  assert.doesNotMatch(raw, /raw_text|image_url|<p>|<img/)
})

test('date semantics: explicit event date, then report date, then observation; business-local dates never shift through UTC', async () => {
  const { businessDate } = load(root + 'dates.ts')
  assert.equal(businessDate('2026-09-15'), '2026-09-15')
  assert.equal(businessDate('2026-09-15T00:00:00+09:00'), '2026-09-15')
  assert.equal(businessDate('2026-09-14T15:00:00+00:00'), '2026-09-15') // the same instant, as PostgREST returns it
  assert.equal(businessDate('2026-09-15T14:59:59Z'), '2026-09-15')
  assert.equal(businessDate('2026-09-15T15:00:00Z'), '2026-09-16')
  const base = { startedAt: null, lastObservedAt: '2026-10-01T15:30:00+00:00' }
  assert.deepEqual(movementOccurrence({ ...base, evidence: [{ eventDate: '2026-09-03', source: { publishedAt: '2026-09-09T00:00:00+09:00' } }] }), { occurredOn: '2026-09-03', dateBasis: 'event' })
  assert.deepEqual(movementOccurrence({ ...base, evidence: [{ eventDate: null, source: { publishedAt: '2026-09-14T15:00:00+00:00' } }] }), { occurredOn: '2026-09-15', dateBasis: 'reported' })
  assert.deepEqual(movementOccurrence({ ...base, evidence: [{ eventDate: null, source: { publishedAt: null } }] }), { occurredOn: '2026-10-02', dateBasis: 'observed' })
  const db = await seeded()
  try {
    // OLIVE YOUNG mobile skin scan: the source states no launch day; it was reported on 2026-09-15 (KST).
    const evidence = dataset.launchEvidence.find(row => row.id === lid(307)), source = dataset.launchSources.find(row => row.id === evidence.sourceId)
    assert.deepEqual([evidence.eventDate, evidence.datePrecision, source.publishedAt, source.datePrecision], [null, 'unknown', '2026-09-15T00:00:00+09:00', 'day'])
    const graph = await loadLineageGraph(queryClient(db), entity('olive-young'))
    const movement = graph.movements.find(row => row.id === lid(404))
    assert.match(movement.evidence[0].source.publishedAt, /^2026-09-14T15:00:00/) // stored instant, returned in UTC
    assert.deepEqual(movementOccurrence(movement), { occurredOn: '2026-09-15', dateBasis: 'reported' })
    assert.equal(graph.patterns.find(row => row.id === lid(502)).windowEnd, '2026-09-15')
    await applyRecommendedProfiles(db)
    const state = buildPublicBrandState('olive-young', await fetchPublicBrandRows(queryClient(db), ['olive-young']), NOW)
    assert.deepEqual(state.movements.find(row => row.title === '모바일 피부 진단 서비스 출시').date, { date: '2026-09-15', precision: 'day', basis: 'reported' })
    assert.deepEqual(state.movements.find(row => row.title === '올리브영 페스타 LA 2026 개최').date, { date: '2026-08-14', precision: 'day', basis: 'event' })
  } finally { await db.close() }
})

test('correction E2E: Evidence → Movement → Pattern → Take → Snapshot v1, then correction, remediation and current Snapshot v2', async () => {
  const db = await seeded()
  try {
    const baemin = entity('baemin'), client = seedClient(db)
    const extra = { p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: NOW, p_confidence: 0.6, p_uncertainties: [] }
    await db.query(`UPDATE brand_watch_profiles SET public_status='published' WHERE entity_id=$1`, [baemin])
    // Snapshot v1 on the reviewed lineage: Take 631 → Pattern 531 → Movements 431/433 → Evidence 331/332/335 → Sources 231/232/234.
    const v1 = { ...extra, p_id: lid(731), p_entity_id: baemin, p_headline: '멤버십 적립과 장보기·쇼핑 상품군을 함께 넓히는 중', p_body: '배민클럽 신규 상품이 적립 범위를 픽업·장보기·쇼핑으로 넓히고, 장보기·쇼핑에 뷰티 판매점이 입점했다.', p_watch_next: '배민클럽 에디션2 적립이 장보기·쇼핑 이용과 어떻게 연결되는지.', p_valid_from: '2026-10-08T00:00:00+09:00', p_evidence_count: 3, p_source_count: 3, p_revision: 1, p_supersedes_id: null, p_take_ids: [lid(631)] }
    assert.equal((await client.rpc('brand_watch_save_snapshot_draft', v1)).error, null)
    await review(db, { command: 'snapshot.publish', snapshotId: lid(731), reason: 'Snapshot v1 reviewed.' })
    let state = bySlug(await states(db), 'baemin')
    assert.deepEqual([state.snapshot.headline, /출시한다고 밝혔다/.test(JSON.stringify(state))], [v1.p_headline, true])

    // Correction: the announced-plan fact is superseded by the confirmed launch report (HuffPost Korea: "1일 배민클럽 에디션2를 출시했다").
    const corrected = await review(db, { command: 'evidence.supersede', evidenceId: lid(331), reason: '출시 예정 발표를 실제 출시 보도로 교정', successor: { sourceItemId: lid(232), fact: '우아한형제들은 2026년 10월 1일 배민클럽 에디션2를 출시했다.', supportText: "배달의민족 운영사 우아한형제들은 1일 '배민클럽 에디션2'를 출시했다.", supportLocator: null, eventDate: '2026-10-01', datePrecision: 'day', marketingRelevance: 1, confidence: 0.9 } })
    const health = evaluateLineageHealth(await loadLineageGraph(queryClient(db), baemin), NOW)
    const status = (kind, n) => health.results.find(row => row.kind === kind && row.id === lid(n)).health
    assert.deepEqual([status('movement', 431), status('pattern', 531), status('take', 631), status('snapshot', 731)], ['REVIEW_REQUIRED', 'STALE', 'STALE', 'STALE'])
    // While under correction the affected lineage is withheld whole; unaffected facts stay.
    state = bySlug(await states(db), 'baemin')
    assert.deepEqual([state.kind, state.snapshot, state.patterns.length, state.takes.length], ['available', null, 0, 0])
    assert.deepEqual(state.movements.map(row => row.title).sort(), ["서울시와 '9월말 투아웃' 픽업 캠페인", '장보기·쇼핑에 뷰티 판매점 오프뷰티 입점'])
    assert.doesNotMatch(JSON.stringify(state), /출시한다고 밝혔다/)

    // Human remediation: corrected Evidence → new Movement → Pattern revision → Take → Snapshot v2. Nothing regenerates by itself.
    const successor = corrected.result.successorId
    await review(db, { command: 'evidence.approve', evidenceId: successor, matchRole: 'primary', reason: '실제 출시 보도 확인' })
    const movement = await review(db, { command: 'movement.supersede', movementId: lid(431), reason: '교정된 Evidence로 Movement 갱신', successor: { eventKey: 'baemin-club-edition-2-launched', title: "포인트 적립형 '배민클럽 에디션2' 출시", summary: '10월 1일 결제 금액에 따라 배민포인트를 적립하는 배민클럽 신규 상품을 출시했다. 적립은 음식 배달뿐 아니라 픽업과 장보기·쇼핑 결제에도 적용된다.', movementType: 'product', scope: 'national', market: ['KR'], channel: ['online'], startedAt: null, lastObservedAt: '2026-10-01T00:00:00+09:00', importance: 3, evidenceIds: [successor, lid(332)] } })
    await review(db, { command: 'movement.approve', movementId: movement.result.successorId, reason: 'Corrected lineage reviewed.' })
    const pattern = dataset.launchPatterns.find(row => row.id === lid(531)), take = dataset.launchTakes.find(row => row.id === lid(631))
    assert.equal((await client.rpc('brand_watch_save_pattern_draft', { ...extra, p_id: lid(532), p_entity_id: baemin, p_title: pattern.title, p_description: pattern.description, p_window_start: '2026-10-01', p_window_end: '2026-10-08', p_revision: 2, p_supersedes_id: lid(531), p_movement_ids: [movement.result.successorId, lid(433)] })).error, null)
    await review(db, { command: 'pattern.publish', patternId: lid(532), reason: 'Pattern revision reviewed.' })
    assert.equal((await client.rpc('brand_watch_save_take_draft', { ...extra, p_id: lid(632), p_entity_id: baemin, p_pattern_id: lid(532), p_what_we_see: take.whatWeSee, p_why_it_may_matter: take.whyItMayMatter, p_what_to_watch_next: take.whatToWatchNext, p_revision: 1, p_supersedes_id: null, p_evidence_ids: [successor, lid(332), lid(335)] })).error, null)
    await review(db, { command: 'take.publish', takeId: lid(632), reason: 'Take reviewed against corrected lineage.' })
    const v2 = { ...v1, p_id: lid(732), p_body: '10월 1일 출시된 배민클럽 에디션2가 적립 범위를 픽업·장보기·쇼핑으로 넓히고, 장보기·쇼핑에 뷰티 판매점이 입점했다.', p_evidence_count: 3, p_source_count: 2, p_revision: 2, p_supersedes_id: lid(731), p_take_ids: [lid(632)] }
    assert.equal((await client.rpc('brand_watch_save_snapshot_draft', v2)).error, null)
    const published = await review(db, { command: 'snapshot.publish', snapshotId: lid(732), reason: 'Snapshot v2 reviewed against corrected lineage.' })
    assert.deepEqual([published.result.previousCurrentSnapshotId, published.result.supersededId], [lid(731), lid(731)])

    // v1 history kept; pointer on v2; the public page shows only v2 and the corrected fact.
    assert.deepEqual((await db.query('SELECT id, status, revision FROM brand_snapshots WHERE entity_id=$1 ORDER BY revision', [baemin])).rows.map(row => [row.id, row.status, row.revision]), [[lid(731), 'superseded', 1], [lid(732), 'published', 2]])
    assert.equal((await one(db, 'SELECT current_snapshot_id FROM brand_watch_profiles WHERE entity_id=$1', [baemin])).current_snapshot_id, lid(732))
    assert.deepEqual((await db.query('SELECT action FROM brand_watch_review_events WHERE target_id=$1 ORDER BY occurred_at,action', [lid(731)])).rows.map(row => row.action), ['publish', 'supersede'])
    assert.deepEqual([(await one(db, 'SELECT status FROM brand_evidence WHERE id=$1', [lid(331)])).status, (await one(db, 'SELECT status FROM brand_movements WHERE id=$1', [lid(431)])).status], ['superseded', 'superseded'])
    state = bySlug(await states(db), 'baemin')
    assert.deepEqual([state.snapshot.currentDirection, state.snapshot.sourceCount, state.patterns.length, state.takes.length, state.movements.length], [v2.p_body, 2, 1, 1, 3])
    assert.match(JSON.stringify(state), /2026년 10월 1일 배민클럽 에디션2를 출시했다/)
    assert.doesNotMatch(JSON.stringify(state), /출시한다고 밝혔다/)
    assert.ok(!JSON.stringify(state).includes(v1.p_body), "superseded Snapshot v1 body is not public")
    const healthAfter = evaluateLineageHealth(await loadLineageGraph(queryClient(db), baemin), NOW)
    assert.equal(healthAfter.results.find(row => row.kind === 'snapshot' && row.id === lid(732)).health, 'HEALTHY')

    // Query layer: the public loader itself never reads superseded, draft or review data.
    const rows = await fetchPublicBrandRows(queryClient(db), ['baemin'])
    assert.ok(rows.snapshots.every(row => row.status === 'published') && !rows.snapshots.some(row => row.id === lid(731)))
    assert.ok(rows.evidence.every(row => row.review_status === 'approved' && row.status === 'active') && !rows.evidence.some(row => row.id === lid(331)))
    assert.ok([...rows.movements, ...rows.patterns, ...rows.takes].every(row => row.status === 'published'))
    assert.doesNotMatch(JSON.stringify(rows), /generation_model|prompt_version|confidence|uncertaint|support_text|support_locator|reviewed_by|actor|reason|raw_text|raw_html/)
  } finally { await db.close() }
})

test('022: last_meaningful_update_at moves only on public-impacting changes and never churns on reads, reviews or drafts', async () => {
  const db = await seeded()
  try {
    const musinsa = entity('musinsa'), client = seedClient(db), PAST = '2020-01-01T00:00:00Z'
    const extra = { p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: NOW, p_confidence: 0.6, p_uncertainties: [] }
    const stamps = async () => Object.fromEntries((await db.query('SELECT entity_id, last_meaningful_update_at AS t FROM brand_watch_profiles')).rows.map(row => [row.entity_id, row.t?.getTime() ?? null]))
    const reset = () => db.query('UPDATE brand_watch_profiles SET last_meaningful_update_at=$2 WHERE entity_id=$1', [musinsa, PAST])
    const expect = async (label, action, changed) => {
      await reset(); const before = await stamps()
      await action()
      const after = await stamps()
      assert.equal(after[musinsa] !== Date.parse(PAST), changed, label)
      for (const [id, value] of Object.entries(before)) if (id !== musinsa) assert.equal(after[id], value, `${label}: other brands unchanged`)
    }
    // Not meaningful.
    await expect('public reads', () => states(db), false)
    await expect('admin read model', async () => buildAdminView((await fetchBrandWatchAdminRows(queryClient(db))).rows, NOW), false)
    await expect('health check', async () => evaluateLineageHealth(await loadLineageGraph(queryClient(db), musinsa), NOW), false)
    await expect('source ingestion', async () => {
      await client.insert('source_items', { id: lid(298), provider_id: lid(106), canonical_url: 'https://www.etnews.com/0', original_url: 'https://www.etnews.com/0', title: '수집만 된 소스', date_precision: 'unknown', content_hash: 'e'.repeat(64) })
      await client.insert('source_entity_matches', { source_item_id: lid(298), entity_id: musinsa, role: 'mentioned', confidence: 0.5, method: 'manual', review_status: 'pending' })
      await client.insert('brand_evidence', { id: lid(398), entity_id: musinsa, source_item_id: lid(298), fact: '검수 대기 사실', support_text: '검수 대기', date_precision: 'unknown', marketing_relevance: 1, confidence: 0.5, extraction_method: 'manual' })
    }, false)
    await expect('pending Evidence approval', () => review(db, { command: 'evidence.approve', evidenceId: lid(398), matchRole: 'primary', reason: 'Checked.' }), false)
    await expect('draft Movement save', async () => {
      await client.insert('brand_movements', { id: lid(496), entity_id: musinsa, event_key: 'musinsa-draft-only', title: '초안', summary: '초안', movement_type: 'promotion', scope: 'national', importance: 1 })
      await client.insert('movement_evidence', { entity_id: musinsa, movement_id: lid(496), evidence_id: lid(398) })
    }, false)
    await expect('draft Pattern save', async () => assert.equal((await client.rpc('brand_watch_save_pattern_draft', { ...extra, p_id: lid(519), p_entity_id: musinsa, p_title: '초안 패턴', p_description: '초안', p_window_start: '2026-07-26', p_window_end: '2026-09-28', p_revision: 1, p_supersedes_id: null, p_movement_ids: [lid(411), lid(412)] })).error, null), false)
    await expect('draft Pattern rejection', () => review(db, { command: 'pattern.reject', patternId: lid(519), reason: 'Not needed.' }), false)
    // Meaningful.
    await expect('Movement publish', () => review(db, { command: 'movement.approve', movementId: lid(496), reason: 'Published.' }), true)
    await expect('Pattern publish', async () => {
      assert.equal((await client.rpc('brand_watch_save_pattern_draft', { ...extra, p_id: lid(518), p_entity_id: musinsa, p_title: '오프라인 행사 반복', p_description: '초안', p_window_start: '2026-07-26', p_window_end: '2026-10-08', p_revision: 1, p_supersedes_id: null, p_movement_ids: [lid(411), lid(496)] })).error, null)
      await review(db, { command: 'pattern.publish', patternId: lid(518), reason: 'Published.' })
    }, true)
    await expect('Take publish', async () => {
      assert.equal((await client.rpc('brand_watch_save_take_draft', { ...extra, p_id: lid(618), p_entity_id: musinsa, p_pattern_id: lid(518), p_what_we_see: '관찰', p_why_it_may_matter: '의미일 수 있다.', p_what_to_watch_next: '지켜볼 만하다.', p_revision: 1, p_supersedes_id: null, p_evidence_ids: [lid(311)] })).error, null)
      await review(db, { command: 'take.publish', takeId: lid(618), reason: 'Published.' })
    }, true)
    await expect('Snapshot publish', async () => {
      const snapshot = await one(db, 'SELECT evidence_count, source_count FROM brand_snapshots WHERE id=$1', [lid(711)])
      const takes = (await db.query('SELECT take_id FROM snapshot_takes WHERE snapshot_id=$1', [lid(711)])).rows.map(row => row.take_id)
      assert.equal((await client.rpc('brand_watch_save_snapshot_draft', { ...extra, p_id: lid(712), p_entity_id: musinsa, p_headline: '해외 팝업과 오프라인 매장 행사로 소비자 접점을 넓히는 중', p_body: '개정본', p_watch_next: null, p_valid_from: NOW, p_evidence_count: snapshot.evidence_count, p_source_count: snapshot.source_count, p_revision: 2, p_supersedes_id: lid(711), p_take_ids: takes })).error, null)
      await review(db, { command: 'snapshot.publish', snapshotId: lid(712), reason: 'Revision published.' })
    }, true)
    await expect('Evidence correction behind a published Movement', () => review(db, { command: 'evidence.supersede', evidenceId: lid(398), reason: 'Corrected.', successor: { sourceItemId: null, fact: '교정된 사실', supportText: '교정된 지지 문장', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } }), true)
  } finally { await db.close() }
})
