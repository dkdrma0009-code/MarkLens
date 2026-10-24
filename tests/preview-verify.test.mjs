import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyPreviewDb } from '../scripts/release/verify-preview-db.mjs'

// R-3: verify-preview-db.mjs confirms from an env file alone that its project is the initialised Preview database.
// It must never send a request to production or to a URL it cannot prove is not production.
const PREVIEW = 'https://previewtestproject01.supabase.co'
const env = { NEXT_PUBLIC_SUPABASE_URL: PREVIEW, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-secret-1', SUPABASE_SERVICE_ROLE_KEY: 'service-secret-2', ADMIN_EMAIL: 'preview-admin@example.test' }
const tables = ['articles', 'insights', 'subscribers', 'newsletter_issues', 'newsletter_events', 'insight_challenges', 'insight_sessions', 'content_metrics', 'curations', 'app_config', 'cardnews', 'feedback', 'follower_snapshots', 'quiz_questions', 'site_feedback', 'brand_entities', 'brand_watch_profiles', 'brand_takes', 'ai_usage']
const cols = { newsletter_issues: ['topic_headline', 'approved_at'], subscribers: ['drip_step', 'source', 'confirmation_token'], cardnews: ['reel_settings', 'ig_publish_state', 'threads_publish_state'], insights: ['legacy_slug', 'hook', 'marketing_terms', 'quiz', 'video_url'], articles: ['site_published_at', 'fallback_image'], brand_takes: ['confidence'] }
const rpcs = ['issue_subscription_confirmation', 'brand_watch_approve_evidence', 'brand_watch_publish_pattern', 'brand_watch_mark_meaningful_update', 'consume_ai_quota', 'random_quiz']

// A fresh, correctly initialised Preview project as PostgREST, Storage and Auth would answer; `tweak` breaks one thing.
function fakePreview(tweak = {}) {
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, method: init.method, key: init.headers.apikey })
    const u = new URL(url), json = (body, status = 200, range) => new Response(JSON.stringify(body), { status, headers: range ? { 'content-range': range } : {} })
    if (u.pathname === '/rest/v1/' ) {
      const definitions = Object.fromEntries(tables.filter(t => t !== tweak.dropTable).map(t => [t, { properties: Object.fromEntries((cols[t] ?? ['id']).map(c => [c, {}])) }]))
      if (tweak.competitions) definitions.competitions = { properties: {} }
      return json({ definitions, paths: Object.fromEntries(rpcs.map(f => [`/rpc/${f}`, {}])) })
    }
    if (u.pathname === '/rest/v1/app_config') return json(tweak.noMarker ? [] : [{ value: 'preview' }])
    const counts = { articles: 3, insights: 3, quiz_questions: 2, subscribers: tweak.subscribers ?? 0 }
    const table = u.pathname.replace('/rest/v1/', '')
    if (table === 'subscribers' && init.headers.apikey === 'anon-secret-1') return json({ code: '42501', message: 'permission denied for table subscribers' }, 401)
    if (table in counts) return json([], 200, `0-0/${counts[table]}`)
    if (u.pathname === '/storage/v1/bucket') return json(['ad-assets', 'ad-clips', 'cardnews-ig', 'stock-posters'].map(id => ({ id, public: id !== tweak.privateBucket })))
    if (u.pathname === '/auth/v1/admin/users') return json({ users: tweak.noAdmin ? [] : [{ email: 'preview-admin@example.test' }] })
    return json({}, 404)
  }
  return { fetchImpl, seen }
}
const failed = results => results.filter(r => r.level === 'FAIL').map(r => r.name)

test('verify: a correctly initialised Preview passes; every request is a GET to that project', async () => {
  const { fetchImpl, seen } = fakePreview()
  const results = await verifyPreviewDb(env, fetchImpl)
  assert.deepEqual(failed(results), [])
  assert.ok(seen.length >= 8)
  assert.ok(seen.every(r => r.method === 'GET' && r.url.startsWith(PREVIEW + '/')))
  assert.ok(!JSON.stringify(results).includes('secret'), 'a key was printed')
})

test('verify: production or an unprovable URL is refused before any request', async () => {
  for (const url of ['https://ndehtnchkgvpjbxlkazk.supabase.co', 'https://db.example.com', '', 'http://127.0.0.1:54321']) {
    const { fetchImpl, seen } = fakePreview()
    const results = await verifyPreviewDb({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }, fetchImpl)
    assert.equal(seen.length, 0, url)
    assert.deepEqual(failed(results), ['Preview project (not production, provable)'], url)
  }
})

test('verify: a missing migration, marker, parity step, bucket, admin or real data each fail', async () => {
  const cases = {
    dropTable: ['ai_usage', 'tables of migrations 001–024 and 001a'], noMarker: [true, 'environment marker = preview (seeded by the Preview bundle)'],
    competitions: [true, 'production parity: competitions dropped'], privateBucket: ['ad-clips', 'storage buckets (4, public)'],
    noAdmin: [true, 'test admin user exists in Preview Auth'], subscribers: [12, 'synthetic seed only (3 articles, 3 insights, 2 quiz questions, 0 subscribers)'],
  }
  for (const [key, [value, name]] of Object.entries(cases)) {
    const { fetchImpl } = fakePreview({ [key]: value })
    assert.deepEqual(failed(await verifyPreviewDb(env, fetchImpl)), [name], key)
  }
})
