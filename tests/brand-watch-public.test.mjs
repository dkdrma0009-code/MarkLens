import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

// TS/TSX loader: resolves relative and "@/" imports; next/link is rendered as a plain anchor for SSR checks.
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
const { createElement } = require('react')
const stubs = { 'next/link': { __esModule: true, default: ({ href, children, ...rest }) => createElement('a', { href, ...rest }, children) } }
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
const { executeReviewCommand } = load(root + 'review/commands.ts')
const { fetchPublicBrandRows, PUBLIC_COLUMNS } = load(root + 'public/queries.ts')
const { buildPublicBrandState, buildPublicBrandCard, publicBrandIdentity, publicSignal, PUBLIC_BRAND_SLUGS } = load(root + 'public/view.ts')
const { loadPublicBrandStates } = load(root + 'public/load.ts')
const { brandMetadata, brandsIndexMetadata } = load(root + 'public/metadata.ts')
const { renderToStaticMarkup } = require('react-dom/server')
const BrandDossier = load('src/components/brand-watch/BrandDossier.tsx').default
const BrandIndex = load('src/components/brand-watch/BrandIndex.tsx').default
const migrations = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle', '021_brand_watch_analysis_review_commands'].map(name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))

const entity = slug => launchRegistry.find(row => row.slug === slug).entity
const MUSINSA = entity('musinsa').id, TOSS = entity('toss').id
const id = n => `e6000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const now = '2026-10-14T12:00:00Z'
const who = { actor: 'admin:reviewer@example.test', reason: 'Internal review note — lineage checked.' }
const dossier = state => renderToStaticMarkup(createElement(BrandDossier, { state }))
const index = states => renderToStaticMarkup(createElement(BrandIndex, { cards: states.map(buildPublicBrandCard) }))

// ---------- database fixtures (tests only; never production) ----------
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
const rpc = db => ({ async rpc(fn, args) {
  const keys = Object.keys(args)
  await db.exec('SET ROLE service_role')
  try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
  catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
  finally { await db.exec('RESET ROLE') }
} })
// supabase-js from/select/in subset over PGlite, recording every query for allow-list assertions.
const queries = []
const queryClient = db => ({ from: table => ({ select: columns => {
  const where = []
  const builder = {
    in(column, values) { where.push([column, values]); return builder },
    then(resolve, reject) {
      queries.push({ table, columns, where: where.map(([column, values]) => [column, [...values]]) })
      const sql = `SELECT row_to_json(t) AS row FROM (SELECT ${columns} FROM ${table} WHERE ${where.map(([column], i) => `${column} = ANY($${i + 1})`).join(' AND ')}) t`
      return (async () => {
        await db.exec('SET ROLE service_role')
        try { return { data: (await db.query(sql, where.map(([, values]) => values))).rows.map(row => row.row), error: null } }
        catch (error) { return { data: null, error: { message: error.message } } }
        finally { await db.exec('RESET ROLE') }
      })().then(resolve, reject)
    },
  }
  return builder
} }) })
const insert = async (db, table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(row)) }
const review = async (db, command) => { const result = await executeReviewCommand(rpc(db), { ...who, ...command }); assert.equal(result.ok, true, `${command.command}: ${result.code}`); return result }

const facts = [
  { n: 1, entity: MUSINSA, title: 'MUSINSA Beauty Festa', type: 'campaign', day: '2026-10-01', provider: 1 },
  { n: 2, entity: MUSINSA, title: 'Beauty specialty store expansion', type: 'platform', day: '2026-10-05', provider: 2 },
  { n: 3, entity: MUSINSA, title: 'Beauty creator campaign', type: 'creator', day: '2026-10-08', provider: 3 },
  { n: 5, entity: TOSS, title: 'Toss card promotion', type: 'promotion', day: '2026-10-02', provider: 5 },
  { n: 6, entity: TOSS, title: 'Toss creator series', type: 'creator', day: '2026-10-06', provider: 6 },
]
async function seed(db, { publishChain = true, publicProfiles = true } = {}) {
  for (const slug of ['musinsa', 'toss']) { const e = entity(slug); await insert(db, 'brand_entities', { id: e.id, slug: e.slug, name: e.name, name_ko: e.nameKo, entity_type: e.entityType, category: e.category }) }
  await insert(db, 'articles', { id: id(900), title: 'Article about the festa', status: 'published' })
  await insert(db, 'articles', { id: id(901), title: 'Unpublished article', status: 'pending' })
  await insert(db, 'insights', { article_id: id(900), slug: 'musinsa-beauty-festa-insight', hook: '무신사 뷰티 페스타가 보여준 것' })
  await insert(db, 'insights', { article_id: id(901), slug: 'hidden-insight', hook: 'Hidden unpublished insight' })
  const source = async (n, entityId, title, day, articleId = null) => {
    await insert(db, 'source_providers', { id: id(200 + n), name: `Provider ${n}`, domain: `p${n}.example.test`, provider_type: n === 1 ? 'official_newsroom' : 'industry_media', source_tier: 2, reliability_policy: 'Internal reliability policy text', ingestion_method: 'manual' })
    await insert(db, 'source_items', { id: id(100 + n), provider_id: id(200 + n), canonical_url: `https://p${n}.example.test/article-${n}`, original_url: `https://p${n}.example.test/article-${n}?utm_source=x`, title, date_precision: 'day', published_at: `${day}T00:00:00Z`, content_hash: String(n % 10).repeat(64), raw_text: 'RAW SOURCE BODY must never be public', rights_basis: 'test fixture', retention_until: '2027-01-01T00:00:00Z', existing_article_id: articleId })
    await insert(db, 'source_entity_matches', { source_item_id: id(100 + n), entity_id: entityId, role: 'mentioned', confidence: 0.7, method: 'model', review_status: 'pending' })
    await insert(db, 'brand_evidence', { id: id(10 + n), entity_id: entityId, source_item_id: id(100 + n), fact: `Reviewed fact ${n}`, support_text: 'Synthetic support span SECRET', support_locator: JSON.stringify({ extraction: { model: 'gemini-secret-model' } }), event_date: day, date_precision: 'day', marketing_relevance: 1, confidence: 0.7, extraction_method: 'model', generation_model: 'gemini-secret-model', prompt_version: 'evidence-v1', pipeline_version: 'evidence-movement-v1', review_status: 'pending' })
  }
  // Themes: one approved, one candidate (never public). Links are frozen once a Movement is published.
  await insert(db, 'themes', { id: id(300), slug: 'beauty', name: 'Beauty', status: 'approved' })
  await insert(db, 'themes', { id: id(301), slug: 'secret-candidate', name: 'Candidate theme', status: 'candidate' })
  const themeOf = { 1: id(300), 2: id(300), 3: id(301) }
  // A second report of event 3 from another provider supports the same Movement (one Movement, two sources).
  await source(4, MUSINSA, 'Beauty creator campaign reprint', '2026-10-09')
  await review(db, { command: 'evidence.approve', evidenceId: id(14), matchRole: 'primary' })
  for (const f of facts) {
    await source(f.n, f.entity, `${f.title} report`, f.day, f.n === 1 ? id(900) : f.n === 2 ? id(901) : null)
    await review(db, { command: 'evidence.approve', evidenceId: id(10 + f.n), matchRole: 'primary' })
    await insert(db, 'brand_movements', { id: id(f.n), entity_id: f.entity, event_key: `event-${f.n}`, title: f.title, summary: `${f.title} summary`, movement_type: f.type, scope: 'national', importance: 1, last_observed_at: `${f.day}T09:00:00Z` })
    await insert(db, 'movement_evidence', { entity_id: f.entity, movement_id: id(f.n), evidence_id: id(10 + f.n) })
    if (f.n === 3) await insert(db, 'movement_evidence', { entity_id: f.entity, movement_id: id(3), evidence_id: id(14) })
    if (themeOf[f.n]) await insert(db, 'movement_themes', { movement_id: id(f.n), theme_id: themeOf[f.n] })
    await review(db, { command: 'movement.approve', movementId: id(f.n) })
  }
  // Unreviewed and draft material that must never become public.
  await source(7, MUSINSA, 'Pending pop-up announcement', '2026-10-11')
  await insert(db, 'brand_movements', { id: id(7), entity_id: MUSINSA, event_key: 'event-7', title: 'DRAFT pop-up movement', summary: 'draft', movement_type: 'promotion', scope: 'national', importance: 1 })
  await insert(db, 'movement_evidence', { entity_id: MUSINSA, movement_id: id(7), evidence_id: id(17) })
  await insert(db, 'brand_movements', { id: id(8), entity_id: MUSINSA, event_key: 'event-8', title: 'REJECTED movement', summary: 'rejected', movement_type: 'promotion', scope: 'national', importance: 1 })
  await review(db, { command: 'movement.reject', movementId: id(8) })

  await insert(db, 'brand_patterns', { id: id(50), entity_id: MUSINSA, title: 'Recurring beauty activity', description: 'Observed recurring beauty activity.', window_start: '2026-10-01', window_end: '2026-10-08', confidence: 0.6, uncertainties: ['Short window SECRET.'], generation_model: 'pattern-secret-model', prompt_version: 'pattern-v1', pipeline_version: 'pattern-engine-v1' })
  for (const m of [1, 2, 3]) await insert(db, 'pattern_movements', { entity_id: MUSINSA, pattern_id: id(50), movement_id: id(m) })
  await insert(db, 'brand_takes', { id: id(80), entity_id: MUSINSA, pattern_id: id(50), what_we_see: 'We see repeated beauty moves.', why_it_may_matter: 'It may matter for category expansion.', what_to_watch_next: 'Watch whether offline beauty continues.', confidence: 0.6, uncertainties: ['Single pattern SECRET.'] })
  for (const e of [11, 12, 13]) await insert(db, 'take_evidence', { entity_id: MUSINSA, take_id: id(80), evidence_id: id(e) })
  await insert(db, 'brand_snapshots', { id: id(90), entity_id: MUSINSA, headline: 'Beauty is becoming a recurring direction', body: 'Current direction text.', watch_next: 'Watch next text.', valid_from: '2026-10-08T09:00:00Z', evidence_count: 3, source_count: 3, confidence: 0.6, uncertainties: ['Snapshot SECRET.'] })
  await insert(db, 'snapshot_takes', { entity_id: MUSINSA, snapshot_id: id(90), take_id: id(80) })
  // A draft Pattern/Take on TOSS that must stay hidden.
  await insert(db, 'brand_patterns', { id: id(60), entity_id: TOSS, title: 'DRAFT toss pattern', description: 'draft', window_start: '2026-10-02', window_end: '2026-10-06', confidence: 0.6 })
  for (const m of [5, 6]) await insert(db, 'pattern_movements', { entity_id: TOSS, pattern_id: id(60), movement_id: id(m) })
  if (publishChain) {
    await review(db, { command: 'pattern.publish', patternId: id(50) })
    await review(db, { command: 'take.publish', takeId: id(80) })
    await review(db, { command: 'snapshot.publish', snapshotId: id(90) })
  }
  if (publicProfiles) {
    await db.query(`INSERT INTO brand_watch_profiles(entity_id, public_status, seo_status) VALUES ($1,'published','index'),($2,'published','noindex') ON CONFLICT (entity_id) DO UPDATE SET public_status='published', seo_status=EXCLUDED.seo_status`, [MUSINSA, TOSS])
  }
}
const loadStates = async (db, at = now) => loadPublicBrandStates(() => queryClient(db), PUBLIC_BRAND_SLUGS, at)
const bySlug = (states, slug) => states.find(state => state.brand.slug === slug)
const FORBIDDEN = /admin:reviewer|Internal review note|SECRET|gemini-secret-model|pattern-secret-model|RAW SOURCE BODY|Internal reliability|DRAFT|REJECTED|Pending pop-up|Candidate theme|Hidden unpublished|utm_source|service_role|SUPABASE|eyJ/

test('1/2/5: public read model exposes only published, current, eligible lineage — composed Snapshot → Take → Pattern → Movement → Source', async () => {
  const db = await database()
  try {
    await seed(db)
    queries.length = 0
    const states = await loadStates(db)
    const musinsa = bySlug(states, 'musinsa')
    assert.equal(musinsa.kind, 'available')
    assert.deepEqual(musinsa.movements.map(row => [row.anchor, row.title]), [['move-1', 'Beauty creator campaign'], ['move-2', 'Beauty specialty store expansion'], ['move-3', 'MUSINSA Beauty Festa']])
    const creator = musinsa.movements[0]
    // Two reports of one event stay one Movement with two footnoted sources from two providers.
    assert.deepEqual([creator.facts.length, creator.sourceRefs, creator.providerCount, creator.date], [2, [1, 2], 2, { date: '2026-10-08', precision: 'day', basis: 'event' }])
    assert.deepEqual(musinsa.patterns.map(row => [row.anchor, row.title, row.movementAnchors.map(m => m.anchor), row.asOfOnly]), [['pattern-1', 'Recurring beauty activity', ['move-1', 'move-2', 'move-3'], false]])
    assert.deepEqual(musinsa.takes.map(row => [row.anchor, row.pattern.anchor, row.sourceRefs]), [['take-1', 'pattern-1', [1, 3, 4]]])
    assert.deepEqual([musinsa.snapshot.headline, musinsa.snapshot.watchNext, musinsa.snapshot.takeAnchors, musinsa.snapshot.evidenceCount, musinsa.snapshot.asOfOnly], ['Beauty is becoming a recurring direction', 'Watch next text.', [{ anchor: 'take-1', patternTitle: 'Recurring beauty activity' }], 3, false])
    assert.deepEqual(musinsa.sources.map(row => [row.ref, row.provider, row.url]), [[1, 'Provider 3', 'https://p3.example.test/article-3'], [2, 'Provider 4', 'https://p4.example.test/article-4'], [3, 'Provider 2', 'https://p2.example.test/article-2'], [4, 'Provider 1', 'https://p1.example.test/article-1']])
    assert.deepEqual(musinsa.themes, [{ slug: 'beauty', name: 'Beauty' }])
    // Related Insight only through a stored source → published Article link.
    assert.deepEqual(musinsa.relatedInsights, [{ slug: 'musinsa-beauty-festa-insight', title: '무신사 뷰티 페스타가 보여준 것' }])
    // No stored meaningful-update time yet: the latest reviewed observation (Snapshot as-of) is used.
    assert.equal(Date.parse(musinsa.lastUpdate), Date.parse('2026-10-08T09:00:00Z'))
    // TOSS: published Movements only; the draft Pattern stays hidden; no Snapshot.
    const toss = bySlug(states, 'toss')
    assert.deepEqual([toss.kind, toss.movements.length, toss.patterns.length, toss.takes.length, toss.snapshot, toss.indexable], ['available', 2, 0, 0, null, false])
    // Launch brands not in the database are unavailable shells, never fabricated.
    for (const slug of ['olive-young', 'baemin', 'danggeun']) assert.deepEqual(bySlug(states, slug), { kind: 'unavailable', brand: publicBrandIdentity(slug) })
    // Nothing internal reaches the read model.
    assert.doesNotMatch(JSON.stringify(states), FORBIDDEN)
    for (const key of ['confidence', 'uncertainties', 'reviewStatus', 'review_status', 'actor', 'reason', 'eventKey', 'event_key', 'supportText', 'generationModel', 'contentHash', 'health']) assert.ok(!JSON.stringify(states).includes(`"${key}"`), key)
    // Every query is an explicit allow-list with state filters on analysis / fact rows.
    const forbiddenColumns = /raw_text|raw_html|support_text|support_locator|generation_model|prompt_version|pipeline_version|reviewed_by|confidence|uncertainties|correction_reason|actor|reason|author|rights_basis|retention_until|reliability_policy|\*/
    for (const query of queries) assert.doesNotMatch(query.columns, forbiddenColumns, `${query.table}: ${query.columns}`)
    for (const columns of Object.values(PUBLIC_COLUMNS)) assert.doesNotMatch(columns, forbiddenColumns)
    assert.ok(!queries.some(query => query.table === 'brand_watch_review_events'))
    const filter = (table, column) => queries.filter(query => query.table === table).every(query => query.where.some(([name]) => name === column))
    for (const [table, column] of [['brand_movements', 'status'], ['brand_patterns', 'status'], ['brand_takes', 'status'], ['brand_snapshots', 'status'], ['brand_evidence', 'review_status'], ['brand_evidence', 'status'], ['themes', 'status'], ['articles', 'status'], ['brand_entities', 'status']]) assert.ok(filter(table, column), `${table}.${column}`)
    for (const table of ['brand_movements', 'brand_patterns', 'brand_takes', 'brand_snapshots']) assert.ok(queries.filter(query => query.table === table).every(query => JSON.stringify(query.where.find(([name]) => name === 'status')[1]) === '["published"]'), table)
  } finally { await db.close() }
})

test('4: private profiles, inactive entities and unregistered brands share one unavailable state; unknown slugs have no page', async () => {
  const db = await database()
  try {
    await seed(db, { publicProfiles: false })
    let states = await loadStates(db)
    // Snapshot publish created a default private profile: nothing is shown and existence is not revealed.
    assert.deepEqual(['musinsa', 'toss'].map(slug => bySlug(states, slug).kind), ['unavailable', 'unavailable'])
    assert.doesNotMatch(JSON.stringify(states), /Beauty|Toss card/)
    // A reviewed override can publish; the override wins over the stored status.
    await db.query(`UPDATE brand_watch_profiles SET public_override = true, override_reason = 'Reviewed launch' WHERE entity_id = $1`, [MUSINSA])
    states = await loadStates(db)
    assert.equal(bySlug(states, 'musinsa').kind, 'available')
    await db.query(`UPDATE brand_entities SET status = 'inactive' WHERE id = $1`, [MUSINSA])
    assert.equal(bySlug(await loadStates(db), 'musinsa').kind, 'unavailable')
  } finally { await db.close() }
  // Unknown slugs: no identity, no state, and the route renders only registry slugs (dynamicParams = false).
  assert.equal(publicBrandIdentity('unknown-brand'), null)
  assert.equal(buildPublicBrandState('unknown-brand', { entities: [], profiles: [] }, now), null)
  assert.deepEqual(PUBLIC_BRAND_SLUGS, ['musinsa', 'olive-young', 'toss', 'baemin', 'danggeun'])
  const page = readFileSync('src/app/(public)/brands/[slug]/page.tsx', 'utf8')
  assert.match(page, /export const dynamicParams = false/); assert.match(page, /PUBLIC_BRAND_SLUGS\.map\(slug => \(\{ slug \}\)\)/); assert.match(page, /if \(!state\) notFound\(\)/)
})

test('6: broken, corrected or unpublished lineage is withheld instead of patched; other brands are unaffected', async () => {
  const db = await database()
  try {
    await seed(db)
    // Correcting one Evidence: its Movement is no longer fully supported, so the Pattern, Take and Snapshot that depend on it are hidden.
    await review(db, { command: 'evidence.supersede', evidenceId: id(11), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })
    const states = await loadStates(db)
    const musinsa = bySlug(states, 'musinsa')
    assert.deepEqual([musinsa.movements.map(row => row.title), musinsa.patterns, musinsa.takes, musinsa.snapshot], [['Beauty creator campaign', 'Beauty specialty store expansion'], [], [], null])
    assert.doesNotMatch(JSON.stringify(musinsa), /Corrected|Reviewed fact 1"/)
    assert.equal(bySlug(states, 'toss').movements.length, 2)
  } finally { await db.close() }

  // Pure rows: a Pattern linking an unloaded (draft) Movement, a Take outside its Pattern lineage and a Snapshot
  // whose stored counts no longer match lineage are all hidden.
  const db2 = await database()
  try {
    await seed(db2)
    const rows = await fetchPublicBrandRows(queryClient(db2), ['musinsa'])
    const brokenPattern = { ...rows, patternMovements: [...rows.patternMovements, { pattern_id: id(50), movement_id: id(7) }] }
    const a = buildPublicBrandState('musinsa', brokenPattern, now)
    assert.deepEqual([a.patterns.length, a.takes.length, a.snapshot], [0, 0, null])
    const strayTake = { ...rows, takeEvidence: [...rows.takeEvidence, { take_id: id(80), evidence_id: id(15) }] }
    assert.deepEqual([buildPublicBrandState('musinsa', strayTake, now).takes.length, buildPublicBrandState('musinsa', strayTake, now).snapshot], [0, null])
    const miscounted = { ...rows, snapshots: rows.snapshots.map(row => ({ ...row, evidence_count: 99 })) }
    const c = buildPublicBrandState('musinsa', miscounted, now)
    assert.deepEqual([c.snapshot, c.takes.length, c.indexable], [null, 1, false])
    // Freshness only: past the 90-day window the analysis stays visible, marked with its as-of date.
    const later = buildPublicBrandState('musinsa', rows, '2027-03-01T00:00:00Z')
    assert.deepEqual([later.patterns[0].asOfOnly, later.takes[0].asOfOnly, later.snapshot.asOfOnly], [true, true, true])
    assert.match(dossier(later), /이 요약은 2026\.10\.08 기준입니다/)
  } finally { await db2.close() }
})

test('7/10: SSR — full, partial, empty and error states; FACT / PATTERN / TAKE separated; sources traceable', async () => {
  const db = await database()
  try {
    await seed(db)
    const states = await loadStates(db)
    const html = dossier(bySlug(states, 'musinsa'))
    assert.match(html, /<h1 id="bw-title">MUSINSA/); assert.match(html, /bw-hero-signal-label">Current signal</)
    assert.match(html, /CURRENT DIRECTION/); assert.match(html, /WATCH NEXT/); assert.match(html, /2026\.10\.08<\/time> 기준/)
    // Distinct, text-labelled layers.
    assert.ok((html.match(/bw-label-fact">FACT</g) ?? []).length >= 4)
    assert.match(html, /bw-label-pattern">OBSERVED PATTERN</); assert.match(html, /bw-label-take">MARKLENS TAKE</)
    assert.match(html, /사실\(FACT\)이 아니라, 위의 Observed Pattern을 바탕으로 한 MarkLens의 해석입니다/)
    assert.match(html, /WHAT WE SEE/); assert.match(html, /WHY IT MAY MATTER/); assert.match(html, /WHAT TO WATCH NEXT/)
    // Take → Pattern → Movement → Source chain is navigable.
    assert.match(html, /href="#pattern-1">Recurring beauty activity/)
    assert.match(html, /href="#move-1">Beauty creator campaign/)
    assert.match(html, /href="#source-1" aria-label="출처 1번으로 이동">\[1\]/)
    assert.match(html, /<li id="source-1">/)
    assert.match(html, /href="https:\/\/p3\.example\.test\/article-3" target="_blank" rel="noopener noreferrer"/)
    assert.match(html, /원문, 새 창에서 열림/)
    assert.match(html, /<details class="bw-evidence"><summary>확인된 사실 2건 보기<\/summary>/)
    assert.match(html, /href="\/insights\/musinsa-beauty-festa-insight"/)
    assert.doesNotMatch(html, FORBIDDEN)
    assert.doesNotMatch(html, /HEALTHY|STALE|REVIEW_REQUIRED|BROKEN|Score|\/100|%/)
    // Partial: Movements without Snapshot / Pattern / Take.
    const partial = dossier(bySlug(states, 'toss'))
    // No Snapshot: a one-line status, and the hero names its lead line for what it is (never "Current signal").
    assert.match(partial, /<h2 id="snapshot-title">현재 공개 Snapshot 없음<\/h2>/); assert.match(partial, /아래에서 공개 자료로 확인된 움직임을 먼저 볼 수 있습니다/)
    assert.match(partial, /bw-hero-signal-label">Latest move</); assert.doesNotMatch(partial, /Current signal|CURRENT SIGNAL/)
    assert.match(partial, /아직 공개된 Observed Pattern이 없습니다/); assert.match(partial, /아직 공개된 MarkLens Take가 없습니다/)
    assert.match(partial, /Toss creator series/)
    // Empty: registry brand without public data.
    const empty = dossier(bySlug(states, 'olive-young'))
    assert.match(empty, /아직 공개된 Brand Watch 데이터가 없습니다/); assert.doesNotMatch(empty, /id="snapshot"|id="moves"/)
    // Index: real data only, honest fallbacks, no scores.
    const list = index(states)
    assert.match(list, /브랜드의 최근 움직임에서<br\/>반복되는 방향을 읽습니다/); assert.match(list, /Beauty is becoming a recurring direction/)
    assert.match(list, /href="\/brands\/olive-young"/); assert.ok((list.match(/아직 공개된 Brand Watch 데이터가 없습니다/g) ?? []).length === 3)
    assert.doesNotMatch(list, FORBIDDEN); assert.doesNotMatch(list, /\/100|Score|%/)
  } finally { await db.close() }
  // Error: a failing query or a client that cannot be created yields explicit error states without numbers.
  const failing = { from: () => ({ select: () => { const b = { in: () => b, then: (resolve) => resolve({ data: null, error: { message: 'secret db message' } }) }; return b } }) }
  const errors = await loadPublicBrandStates(() => failing, PUBLIC_BRAND_SLUGS, now)
  assert.deepEqual(errors.map(state => state.kind), ['error', 'error', 'error', 'error', 'error'])
  assert.deepEqual((await loadPublicBrandStates(() => { throw new Error('supabaseUrl is required') }, ['toss'], now)).map(state => state.kind), ['error'])
  const errorHtml = dossier(errors[0]) + index(errors)
  assert.match(errorHtml, /데이터를 불러오지 못했습니다/); assert.doesNotMatch(errorHtml, /secret|\d+건/)
})

test('8: metadata — snapshot-based description only when a Snapshot exists, canonical URLs, noindex unless SEO-eligible', async () => {
  const db = await database()
  try {
    await seed(db)
    const states = await loadStates(db)
    const full = brandMetadata(bySlug(states, 'musinsa'))
    assert.deepEqual([full.title, full.alternates.canonical, full.openGraph.url, full.robots], ['무신사 Brand Watch | MarkLens', '/brands/musinsa', '/brands/musinsa', undefined])
    assert.match(full.description, /^Beauty is becoming a recurring direction — 최근 공개 자료와 마케팅 움직임을 바탕으로 무신사의/)
    const partial = brandMetadata(bySlug(states, 'toss'))
    assert.equal(partial.description, '최근 공개 자료와 마케팅 움직임을 바탕으로 토스의 주요 변화와 반복 패턴을 살펴봅니다.')
    assert.deepEqual(partial.robots, { index: false, follow: true })
    const shell = brandMetadata(bySlug(states, 'danggeun'))
    assert.deepEqual([shell.title, shell.alternates.canonical, shell.robots], ['당근 Brand Watch | MarkLens', '/brands/danggeun', { index: false, follow: true }])
    const indexMeta = brandsIndexMetadata(states)
    assert.deepEqual([indexMeta.alternates.canonical, indexMeta.robots], ['/brands', undefined])
    // Chapter 7 (§16): the /brands directory stays indexable whenever data loads, even with no indexable brand page;
    // only a failed load (every brand in the error state) makes it noindex.
    assert.equal(brandsIndexMetadata(states.filter(state => state.brand.slug !== 'musinsa')).robots, undefined)
    assert.deepEqual(brandsIndexMetadata(states.map(state => ({ kind: 'error', brand: state.brand }))).robots, { index: false, follow: true })
  } finally { await db.close() }
})

test('9: no service-role client or environment in rendering or client bundles; public routes are Server Components', () => {
  const componentDir = 'src/components/brand-watch', libDir = `${root}public`
  for (const file of [...readdirSync(componentDir).map(name => `${componentDir}/${name}`), ...readdirSync(libDir).map(name => `${libDir}/${name}`)]) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /"use client"|supabase\/admin|SERVICE_ROLE|process\.env|createAdminClient|createClient/, file)
  }
  for (const file of ['src/app/(public)/brands/page.tsx', 'src/app/(public)/brands/[slug]/page.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /"use client"/, file)
    assert.match(source, /createAdminClient\(\) as unknown as PublicQueryClient/, file)
    assert.match(source, /export const revalidate = 21600/, file)
    assert.doesNotMatch(source, /brand-watch\/admin|lifecycle\/load/, file)
  }
  // The admin read model is not reused by the public layer.
  for (const name of readdirSync(libDir)) assert.doesNotMatch(readFileSync(`${libDir}/${name}`, 'utf8'), /from "\.\.\/admin/, name)
})

const visualRow = (n, extra = {}) => ({ sourceUrl: `https://p${n}.example.test/article-${n}`, imageUrl: `https://img${n}.example.test/v.jpg`, alt: `Evidence visual ${n}`, origin: 'media', credit: `Credit ${n}`, checkedAt: '2026-10-15', note: 'INTERNAL VISUAL NOTE', ...extra })
test('11: visual evidence — only from public, eligible sources; provenance kept; invalid, rejected or corrected images never shown', async () => {
  const registry = [visualRow(7), visualRow(3), visualRow(4), visualRow(2, { imageUrl: 'javascript:alert(1)' }), visualRow(1, { imageUrl: 'https://cdn.musebyclios.com/x.jpg' }), visualRow(5, { imageUrl: 'http://img5.example.test/v.jpg' }), visualRow(6, { alt: '  ' })]
  const db = await database()
  try {
    await seed(db)
    // Pending (p7) then explicitly rejected Evidence: its source never reaches a Movement, so its image never shows.
    await review(db, { command: 'evidence.reject', evidenceId: id(17) })
    const rows = await fetchPublicBrandRows(queryClient(db), ['musinsa', 'toss'])
    const musinsa = buildPublicBrandState('musinsa', rows, now, registry), toss = buildPublicBrandState('toss', rows, now, registry)
    // move-1 (two reports, p3 + p4): the first usable registry image, tied to its footnote, provider and credit.
    assert.deepEqual(musinsa.movements[0].visual, { src: 'https://img3.example.test/v.jpg', alt: 'Evidence visual 3', sourceRef: 1, provider: 'Provider 3', origin: 'media', credit: 'Credit 3', fit: 'cover' })
    // Invalid scheme, a hotlink-blocked host, plain http and a blank alt all fall back to no visual.
    assert.deepEqual([...musinsa.movements.slice(1), ...toss.movements].map(row => row.visual), [null, null, null, null])
    const json = JSON.stringify([musinsa, toss])
    assert.doesNotMatch(json, /img7\.example|INTERNAL VISUAL NOTE|checkedAt|"note"|musebyclios|javascript:/)
    // The index card leads with the same evidence; the signal semantics stay distinct.
    assert.deepEqual(buildPublicBrandCard(musinsa).visual, musinsa.movements[0].visual)
    assert.deepEqual([publicSignal(musinsa).kind, publicSignal({ ...musinsa, snapshot: null }), publicSignal({ ...musinsa, snapshot: null, patterns: [] })], ['snapshot', { kind: 'pattern', text: 'Recurring beauty activity', anchor: 'pattern-1' }, { kind: 'movement', text: 'Beauty creator campaign', anchor: 'move-1' }])
    assert.match(dossier({ ...musinsa, snapshot: null }), /bw-hero-signal-label">Observed direction</)
    // SSR: CDN-sized image (no Vercel optimisation), meaningful alt, eager only in the hero and lazy below it,
    // credit linked to the footnoted source; moves without a visual render no image at all.
    const html = dossier(musinsa)
    const imgs = html.match(/<img [^>]*>/g) ?? []
    // The hero carries move-1's evidence once; below it only the Pattern frame repeats it (Key Moves and the timeline do not).
    assert.equal(imgs.filter(tag => /alt="Evidence visual 3"/.test(tag) && /loading="eager"/.test(tag)).length, 1)
    assert.equal(imgs.filter(tag => /alt="Evidence visual 3"/.test(tag) && /loading="lazy"/.test(tag)).length, 1)
    assert.ok(imgs.every(tag => /src="https:\/\/images\.weserv\.nl\/\?url=img3\.example\.test%2Fv\.jpg&amp;w=\d+/.test(tag)), imgs.join('\n'))
    assert.doesNotMatch(html, /\/_next\/image/)
    assert.match(html, /href="#source-1" aria-label="이미지 출처 1번으로 이동">Credit 3 제공 · Provider 3 \[1\]/)
    assert.match(html, /<li id="move-2" class="bw-move"><span class="bw-date">/)
    assert.match(html, /이미지 게재/)
    assert.doesNotMatch(html, FORBIDDEN)
    // Decorative repeats (index crop) carry an empty alt.
    assert.match(index([musinsa]), /class="bw-dir-visual"><span class="bw-visual"[^>]*><img alt=""/)
    // Every Movement pictured: no visual appears more than twice in the reading flow, the hero's Movement is not
    // re-featured in Key Moves, and three Movements give a compact archive timeline without images or summaries.
    const pictured = buildPublicBrandState('musinsa', rows, now, [visualRow(3), visualRow(2), visualRow(1)])
    const full = dossier(pictured), counts = {}
    for (const [, src] of full.matchAll(/<img [^>]*src="([^"]+)"/g)) { const key = src.replace(/&amp;w=\d+.*/, ''); counts[key] = (counts[key] ?? 0) + 1 }
    assert.deepEqual(Object.values(counts).sort(), [2, 2, 2])
    assert.doesNotMatch(full.slice(full.indexOf('id="key-moves"'), full.indexOf('id="patterns"')), /href="#move-1"/)
    const timeline = full.slice(full.indexOf('id="moves"'), full.indexOf('id="sources"'))
    assert.match(timeline, /bw-move-list bw-move-list-compact/); assert.doesNotMatch(timeline, /<img|bw-move-summary/)
    assert.match(timeline, /<li id="move-1" class="bw-move">/)

    // Correction: superseding the Evidence behind p3 hides that Movement and therefore its image.
    await review(db, { command: 'evidence.supersede', evidenceId: id(13), successor: { sourceItemId: null, fact: 'Corrected', supportText: 'Corrected support', supportLocator: null, eventDate: null, datePrecision: 'unknown', marketingRelevance: 1, confidence: 0.5 } })
    const corrected = buildPublicBrandState('musinsa', await fetchPublicBrandRows(queryClient(db), ['musinsa']), now, registry)
    assert.doesNotMatch(JSON.stringify(corrected), /img3\.example|img4\.example/)
    assert.doesNotMatch(dossier(corrected), /<img/)
  } finally { await db.close() }
})

test('12: launch visual registry — every image belongs to approved launch Evidence, is https, credited and described', () => {
  const { launchVisuals } = load(root + 'launch/visuals.ts')
  const { launchSources, launchEvidence } = load(root + 'launch/dataset.ts')
  const { isHotlinkBlocked } = load('src/lib/images.ts')
  const href = url => new URL(url).href
  const approved = new Set(launchEvidence.filter(row => row.decision.action === 'approve').map(row => row.sourceId))
  const rejectedOnly = new Set(launchEvidence.filter(row => row.decision.action === 'reject' && !approved.has(row.sourceId)).map(row => row.sourceId))
  assert.ok(launchVisuals.length >= 15 && rejectedOnly.size >= 5)
  for (const visual of launchVisuals) {
    const source = launchSources.find(row => href(row.url) === href(visual.sourceUrl))
    assert.ok(source && approved.has(source.id), visual.sourceUrl + ' must be an approved launch source')
    assert.match(visual.imageUrl, /^https:\/\//); assert.ok(!isHotlinkBlocked(visual.imageUrl))
    assert.ok(visual.alt.trim().length >= 10 && !/^(image|photo|이미지|사진)$/i.test(visual.alt.trim()), visual.alt)
    assert.ok(['official', 'newsroom', 'media'].includes(visual.origin) && visual.credit.trim() && visual.checkedAt)
  }
  assert.equal(new Set(launchVisuals.map(row => href(row.sourceUrl))).size, launchVisuals.length)
  for (const id of rejectedOnly) assert.ok(!launchVisuals.some(row => href(row.sourceUrl) === href(launchSources.find(source => source.id === id).url)), id)
})
