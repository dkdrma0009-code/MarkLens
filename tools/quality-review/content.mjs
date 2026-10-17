// Quality Review — Content QA (structural). Local only: the real launch dataset is seeded into PGlite and read through
// the real public read model and lineage-health code. Nothing here judges whether a fact is true; questions of meaning
// are raised for a person (review: 'human'). Rule reference: docs/quality-review/content-review.md.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

// TypeScript source loader (same approach as the test suite): transpile on the fly, resolve "@/" to src/.
const cache = new Map()
function resolve(from, key) {
  const base = key.startsWith('@/') ? path.resolve('src', key.slice(2)) : path.resolve(path.dirname(from), key)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base]) if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate
  throw new Error(`Cannot resolve ${key}`)
}
export function loadSource(file) {
  const ts = require('typescript')
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  cache.set(file, loaded.exports)
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(key => key.startsWith('.') || key.startsWith('@/') ? loadSource(resolve(file, key)) : require(key), loaded, loaded.exports)
  cache.set(file, loaded.exports)
  return loaded.exports
}

const MIGRATIONS = ['018_brand_watch_foundation', '019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle', '021_brand_watch_analysis_review_commands', '022_brand_watch_meaningful_update']
const ACTOR = 'admin:quality-review@marklens.test'

// PGlite with the Brand Watch migrations and the launch dataset, at launch visibility (private brands stay private).
export async function openLaunchDatabase() {
  if (!process.env.PGLITE_MODULE) throw new Error('PGLITE_MODULE is not set (local PostgreSQL runtime for Content QA)')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE articles(id uuid PRIMARY KEY, title text, status text NOT NULL DEFAULT 'pending');
    CREATE TABLE insights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid UNIQUE REFERENCES articles(id), slug text NOT NULL, hook text);
    GRANT SELECT ON articles, insights TO service_role;`)
  for (const name of MIGRATIONS) await db.exec(readFileSync(`supabase/migrations/${name}.sql`, 'utf8'))
  const asService = async fn => { await db.exec('SET ROLE service_role'); try { return await fn() } finally { await db.exec('RESET ROLE') } }
  const seedClient = {
    rpc: (fn, args) => asService(async () => {
      const keys = Object.keys(args)
      try { return { data: (await db.query(`SELECT public.${fn}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) AS result`, Object.values(args))).rows[0].result, error: null } }
      catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
    }),
    insert: async (table, row) => { const keys = Object.keys(row); await asService(() => db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(row))) },
  }
  const queryClient = { from: table => ({ select: columns => {
    const state = { where: [], order: null, limit: null }
    const builder = {
      in(column, values) { state.where.push([column, values]); return builder },
      order(column, options = {}) { state.order = `${column} ${options.ascending === false ? 'DESC' : 'ASC'} NULLS ${options.nullsFirst ? 'FIRST' : 'LAST'}`; return builder },
      limit(count) { state.limit = count; return builder },
      then(done, failed) {
        const sql = `SELECT row_to_json(t) AS row FROM (SELECT ${columns} FROM ${table}${state.where.length ? ` WHERE ${state.where.map(([column], i) => `${column} = ANY($${i + 1})`).join(' AND ')}` : ''}${state.order ? ` ORDER BY ${state.order}` : ''}${state.limit ? ` LIMIT ${state.limit}` : ''}) t`
        return asService(async () => {
          try { return { data: (await db.query(sql, state.where.map(([, values]) => values))).rows.map(row => row.row), error: null } }
          catch (error) { return { data: null, error: { message: error.message } } }
        }).then(done, failed)
      },
    }
    return builder
  } }) }
  const root = 'src/lib/brand-watch/'
  const { seedLaunchDataset } = loadSource(root + 'launch/seed.ts')
  const { launchProfileRecommendations } = loadSource(root + 'launch/dataset.ts')
  const { launchRegistry } = loadSource(root + 'registry.ts')
  await seedLaunchDataset(seedClient, { actor: ACTOR })
  const entityId = slug => launchRegistry.find(row => row.slug === slug).entity.id
  for (const row of launchProfileRecommendations) await db.query('UPDATE brand_watch_profiles SET public_status=$2, seo_status=$3 WHERE entity_id=$1', [entityId(row.entity), row.publicStatus, row.seoStatus])
  return { db, queryClient, entityId, close: () => db.close() }
}

// Everything the Brand Watch rules need, read through the real public read model and lineage-health code.
export async function collectBrandWatch({ db, queryClient, entityId }, now = new Date().toISOString()) {
  const root = 'src/lib/brand-watch/'
  const { loadPublicBrandStates } = loadSource(root + 'public/load.ts')
  const { PUBLIC_BRAND_SLUGS } = loadSource(root + 'public/view.ts')
  const { loadLineageGraph } = loadSource(root + 'lifecycle/load.ts')
  const { evaluateLineageHealth } = loadSource(root + 'lifecycle/health.ts')
  const states = await loadPublicBrandStates(() => queryClient, PUBLIC_BRAND_SLUGS, now)
  const lineage = []
  for (const slug of PUBLIC_BRAND_SLUGS) {
    const graph = await loadLineageGraph(queryClient, entityId(slug))
    const titles = new Map([...graph.movements, ...graph.patterns].map(row => [row.id, row.title]))
    lineage.push({ slug, results: evaluateLineageHealth(graph, now).results.map(row => ({ ...row, title: titles.get(row.id) ?? null })) })
  }
  const evidence = new Map((await db.query('SELECT id, review_status, status FROM brand_evidence')).rows.map(row => [row.id, row]))
  // Sources matched to a brand that no evidence uses (collected but never reviewed into the chain).
  const orphans = (await db.query(`SELECT e.slug, s.title FROM source_items s JOIN source_entity_matches m ON m.source_item_id = s.id JOIN brand_entities e ON e.id = m.entity_id
    WHERE NOT EXISTS (SELECT 1 FROM brand_evidence v WHERE v.source_item_id = s.id) ORDER BY e.slug, s.title`)).rows
  return { states, lineage, evidence, orphans }
}

// ---------- Rules (pure) ----------
const red = 'red', yellow = 'yellow'
const finding = (id, level, target, message, extra = {}) => ({ id, area: 'content', level, target, message, review: 'auto', ...extra })
const md = iso => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`
const KST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
const businessDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : KST.format(new Date(value))
// Explicit day mentions only: "2026.10.06" and "10월 19일". Bare "19일" or "10.19" are too ambiguous to compare.
export function mentionedDays(text) {
  const days = new Set()
  for (const m of text.matchAll(/(20\d\d)\.(\d{1,2})\.(\d{1,2})/g)) days.add(`${Number(m[2])}.${Number(m[3])}`)
  for (const m of text.matchAll(/(\d{1,2})월\s?(\d{1,2})일/g)) days.add(`${Number(m[1])}.${Number(m[2])}`)
  return days
}

// Every key the public read model may carry (src/lib/brand-watch/public/types.ts). Anything else is a leak.
const PUBLIC_KEYS = new Set(('kind brand slug name nameKo displayName displayNameSecondary category indexable lastUpdate snapshot headline currentDirection watchNext asOf ' +
  'evidenceCount sourceCount takeAnchors anchor patternTitle asOfOnly movements id title summary movementType date precision basis themes facts fact sourceRef sourceRefs ' +
  'providerCount visual src alt provider origin credit fit focus delivery patterns description windowStart windowEnd movementAnchors takes whatWeSee whyItMayMatter ' +
  'whatToWatchNext pattern sources ref providerType url publishedAt relatedInsights').split(' '))
const INTERNAL_VALUES = /service_role|REVIEW_REQUIRED|HEALTHY|support_text|prompt_version|confidence|admin:/
const keysOf = (value, out = new Set()) => { if (Array.isArray(value)) value.forEach(v => keysOf(v, out)); else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.add(k); keysOf(v, out) } return out }

export function brandWatchFindings({ states, lineage, evidence, orphans = [] }) {
  const out = []
  const nameOf = slug => states.find(s => s.brand.slug === slug)?.brand.displayName ?? slug
  for (const state of states) {
    const brand = state.brand.displayName
    // Leaks: unknown fields or internal values in the public model, and facts whose Evidence is not approved + active.
    const extra = [...keysOf(state)].filter(key => !PUBLIC_KEYS.has(key))
    if (extra.length) out.push(finding('CONTENT-LEAK-001', red, brand, `공개 데이터에 허용되지 않은 필드가 있습니다: ${extra.join(', ')}`))
    if (INTERNAL_VALUES.test(JSON.stringify(state))) out.push(finding('CONTENT-LEAK-001', red, brand, '공개 데이터에 내부 상태 값이 들어 있습니다'))
    if (state.kind !== 'available') continue
    for (const m of state.movements) for (const f of m.facts) {
      const row = evidence.get(f.id)
      if (!row || row.review_status !== 'approved' || row.status !== 'active') out.push(finding('CONTENT-LEAK-002', red, `${brand} · ${m.title}`, `승인되지 않았거나 교정된 근거가 공개 화면에 있습니다 (${row ? `${row.review_status}/${row.status}` : '근거 없음'})`))
    }
    // Movements: what the page needs to state a fact.
    for (const m of state.movements) {
      if (!m.title.trim() || !m.summary.trim()) out.push(finding('CONTENT-MOVEMENT-001', red, `${brand} · ${m.title || m.id}`, '움직임 제목이나 요약이 비어 있습니다'))
      if (!m.facts.length) out.push(finding('CONTENT-MOVEMENT-001', red, `${brand} · ${m.title}`, '공개 움직임에 확인된 근거가 없습니다'))
      if (!m.date) out.push(finding('CONTENT-MOVEMENT-002', yellow, `${brand} · ${m.title}`, '움직임 날짜가 없습니다'))
      // Shown date is the report date, but the movement's own text names another day: which should the reader see?
      if (m.date?.basis === 'reported' && m.date.precision === 'day') {
        const days = [...mentionedDays([m.title, m.summary, ...m.facts.map(f => f.fact), m.visual?.alt ?? ''].join(' '))].filter(day => day !== md(m.date.date))
        if (days.length) out.push(finding('CONTENT-DATE-001', yellow, `${brand} · ${m.title}`, `화면 날짜는 보도일(${md(m.date.date)})인데, 본문·이미지에는 다른 날짜(${days.join(', ')})가 있습니다`,
          { review: 'human', question: `${brand} 「${m.title}」의 날짜를 어떤 기준으로 보여 줄까요?`, reason: `화면은 보도일 ${md(m.date.date)}, 본문·이미지에는 ${days.join(', ')}` }))
      }
    }
    // Patterns: at least two distinct, public supporting movements.
    const anchors = new Set(state.movements.map(m => m.anchor))
    for (const p of state.patterns) {
      const supporting = new Set(p.movementAnchors.map(row => row.anchor))
      if (supporting.size < 2) out.push(finding('CONTENT-PATTERN-001', red, `${brand} · ${p.title}`, `Pattern의 근거 움직임이 ${supporting.size}개입니다 (2개 이상 필요)`))
      const missing = [...supporting].filter(anchor => !anchors.has(anchor))
      if (missing.length) out.push(finding('CONTENT-PATTERN-001', red, `${brand} · ${p.title}`, `Pattern이 공개되지 않은 움직임을 가리킵니다 (${missing.join(', ')})`))
    }
    // Takes: a public Pattern and all three parts.
    const patternAnchors = new Set(state.patterns.map(p => p.anchor))
    for (const t of state.takes) {
      if (!patternAnchors.has(t.pattern.anchor)) out.push(finding('CONTENT-TAKE-001', red, `${brand} · ${t.pattern.title}`, 'Take가 공개된 Pattern에 연결되어 있지 않습니다'))
      if (![t.whatWeSee, t.whyItMayMatter, t.whatToWatchNext].every(text => text?.trim())) out.push(finding('CONTENT-TAKE-001', red, `${brand} · ${t.pattern.title}`, 'Take의 세 부분 중 비어 있는 것이 있습니다'))
    }
    // Snapshot: present on a public page, built from public Takes, and not older than the latest public movement.
    const takeAnchors = new Set(state.takes.map(t => t.anchor))
    if (!state.snapshot) out.push(finding('CONTENT-SNAPSHOT-002', yellow, brand, '공개 브랜드에 Snapshot이 없습니다 (공개 기준과 다름)'))
    else {
      if (state.snapshot.takeAnchors.some(row => !takeAnchors.has(row.anchor))) out.push(finding('CONTENT-SNAPSHOT-003', red, brand, 'Snapshot이 공개되지 않은 Take를 가리킵니다'))
      const asOf = businessDay(state.snapshot.asOf)
      const newer = state.movements.filter(m => m.date && m.date.date > asOf).sort((a, b) => b.date.date.localeCompare(a.date.date))
      if (newer.length) out.push(finding('CONTENT-SNAPSHOT-001', yellow, brand, `Snapshot 기준일(${md(asOf)}) 이후의 움직임 ${newer.length}건이 요약에 반영되지 않았습니다: ${newer.map(m => `${md(m.date.date)} ${m.title}`).join(' / ')}`,
        { review: 'human', question: `${brand} Snapshot을 갱신할까요?`, reason: `Snapshot 기준일 ${md(asOf)}보다 최신 움직임(${md(newer[0].date.date)} ${newer[0].title})이 있습니다` }))
    }
    // Sources: what a footnote needs.
    for (const s of state.sources) if (!s.url || !s.provider || !s.title) out.push(finding('CONTENT-SOURCE-001', red, `${brand} · 출처 [${s.ref}]`, '출처의 주소·제공처·제목 중 빠진 것이 있습니다'))
    const urls = state.sources.map(s => s.url), dup = urls.filter((url, i) => urls.indexOf(url) !== i)
    if (dup.length) out.push(finding('CONTENT-SOURCE-002', yellow, brand, `같은 출처 주소가 두 번 이상 있습니다: ${[...new Set(dup)].join(', ')}`))
  }
  // Lineage health from the existing evaluator (published objects only; retired ones are history).
  const label = { movement: '움직임', pattern: 'Pattern', take: 'Take', snapshot: 'Snapshot' }
  for (const { slug, results } of lineage) for (const row of results) {
    if (row.retired || row.status !== 'published' || row.health === 'HEALTHY') continue
    const level = row.health === 'BROKEN' ? red : yellow, id = row.health === 'BROKEN' ? 'CONTENT-LINEAGE-001' : row.health === 'REVIEW_REQUIRED' ? 'CONTENT-LINEAGE-002' : 'CONTENT-LINEAGE-003'
    out.push(finding(id, level, `${nameOf(slug)} · ${label[row.kind]}${row.title ? ` '${row.title}'` : ''}`, `근거 연결 상태 ${row.health}: ${row.reasons.join(', ')}`))
  }
  for (const row of orphans) out.push(finding('CONTENT-SOURCE-003', 'info', `${nameOf(row.slug)} · ${row.title}`, '수집됐지만 어떤 근거에도 쓰이지 않은 출처입니다 (참고)'))
  return out
}

// ---------- Insights (pure) ----------
// Rows as the public pages select them: slug, legacy_slug, hook, summary, category, article(title, source_name, url,
// image_url, fallback_image, status). Only Insights whose Article is published are public.
export function insightFindings(rows, { isHotlinkBlocked = () => false } = {}) {
  const out = [], pub = rows.filter(row => row.article?.status === 'published')
  const at = row => `인사이트 ${row.slug}`
  const slugs = pub.flatMap(row => [row.slug, row.legacy_slug].filter(Boolean)), dup = [...new Set(slugs.filter((slug, i) => slugs.indexOf(slug) !== i))]
  for (const slug of dup) out.push(finding('INSIGHT-SLUG-001', red, `인사이트 ${slug}`, '같은 주소(slug)를 쓰는 인사이트가 둘 이상입니다'))
  for (const row of pub) {
    const title = (row.hook ?? '').trim() || (row.article?.title ?? '').trim()
    if (!title) out.push(finding('INSIGHT-CONTENT-001', red, at(row), '제목(hook 또는 원문 제목)이 비어 있습니다'))
    if (!(row.category ?? '').trim()) out.push(finding('INSIGHT-CONTENT-001', red, at(row), '카테고리가 비어 있습니다'))
    if (!(row.summary ?? '').trim()) out.push(finding('INSIGHT-CONTENT-002', yellow, at(row), '요약이 비어 있습니다'))
    if (!row.article?.url || !row.article?.source_name) out.push(finding('INSIGHT-SOURCE-001', yellow, at(row), '원문 주소나 출처 이름이 없습니다'))
    const image = row.article?.image_url, fallback = row.article?.fallback_image?.url
    if ((!image || isHotlinkBlocked(image)) && !fallback) out.push(finding('INSIGHT-IMAGE-001', yellow, at(row), image ? '이미지 출처가 차단 매체인데 대체 이미지가 없습니다' : '대표 이미지가 없습니다'))
  }
  return { findings: out, publicCount: pub.length }
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/
// Reads Insights from a local PostgREST (the QA stand-in). A non-local database is never contacted.
export async function fetchLocalInsights(supabaseUrl) {
  if (!supabaseUrl || !LOCAL.test(supabaseUrl)) return { skipped: supabaseUrl ? `로컬 DB가 아니라서 읽지 않았습니다 (${new URL(supabaseUrl).host})` : '로컬 DB 주소가 없습니다' }
  const select = 'slug,legacy_slug,hook,summary,category,article:articles(title,source_name,url,image_url,fallback_image,status)'
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/insights?select=${encodeURIComponent(select)}`, { headers: { apikey: 'local-quality-review' }, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`local insights HTTP ${res.status}`)
  return { rows: await res.json() }
}
