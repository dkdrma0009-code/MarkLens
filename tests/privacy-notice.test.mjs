import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-4 privacy: the policy page, the subscribe-form notice and the footer link stay unpublished until every operator fact
// is confirmed (src/lib/legal/privacy.ts) — no unconfirmed legal text goes out as if final, and today's forms are
// unchanged. When complete, the notice and policy describe what the system really does.
const require = createRequire(import.meta.url)
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const Link = ({ href, children, ...p }) => React.createElement('a', { href, ...p }, children)
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports
}
const privacy = load('src/lib/legal/privacy.ts')
const mocks = { 'next/link': { __esModule: true, default: Link }, '@/lib/legal/privacy': privacy }
const SubscribeNotice = load('src/components/legal/SubscribeNotice.tsx', mocks).default
const PrivacyPolicy = load('src/components/legal/PrivacyPolicy.tsx', mocks).default
// Obviously fictional values, only to exercise the complete state.
const complete = {
  operatorType: 'business', operator: 'TEST-OPERATOR', representative: 'TEST-REP', contactEmail: 'privacy@example.test', privacyOfficer: 'TEST-OFFICER', effectiveDate: '2099-01-01',
  retention: { subscribers: 'TEST-30일', members: 'TEST-탈퇴 시', feedback: 'TEST-1년', aiUsage: 'TEST-30일' },
  disposalProcess: 'TEST-월 1회 파기', databaseRegion: 'TEST-REGION', marketingConsent: 'notice-only', overseasTransferReviewed: true,
}
const html = el => renderToStaticMarkup(el)

test('today: nothing is published — no notice, no footer link, /privacy is a 404', () => {
  assert.equal(privacy.privacyReady(), false)
  // Decided so far: individual operation, database region. Everything else still blocks publishing.
  assert.deepEqual(privacy.missingPrivacyFacts(), ['운영 주체', '문의 메일', '개인정보 보호책임자', '시행일', '보유 기간: 구독자', '보유 기간: Insight Lab 회원', '보유 기간: 피드백', '보유 기간: AI 사용량 기록', '보유 기간 경과 기록 파기 절차', '광고성 정보 동의 필요 여부(법률 검토)', '국외 이전 고지 법률 검토'])
  assert.equal(html(React.createElement(SubscribeNotice, { id: 'n' })), '')
  let notFound = 0
  const page = load('src/app/(public)/privacy/page.tsx', { 'next/navigation': { notFound: () => { notFound++; throw new Error('NEXT_NOT_FOUND') } }, '@/lib/legal/privacy': privacy, '@/components/legal/PrivacyPolicy': { default: PrivacyPolicy } })
  assert.throws(() => page.default(), /NEXT_NOT_FOUND/); assert.equal(notFound, 1)
  const footer = load('src/components/layout/Footer.tsx', { 'next/link': { __esModule: true, default: Link }, '@/lib/brand/WordmarkSvg': { __esModule: true, default: () => null }, './navigation': { CAREER_FEATURES: [] }, '@/lib/legal/privacy': privacy }).default
  assert.doesNotMatch(html(React.createElement(footer)), /\/privacy/)
})

test('readiness: every fact counts; a separate marketing consent blocks publishing until its UI exists', () => {
  assert.deepEqual(privacy.missingPrivacyFacts(complete), [])
  assert.equal(privacy.privacyReady(complete), true)
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, disposalProcess: null }), ['보유 기간 경과 기록 파기 절차'])
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, marketingConsent: 'separate-consent' }), ['광고성 정보 별도 동의 UI(미구현)'])
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, overseasTransferReviewed: false }), ['국외 이전 고지 법률 검토'])
})

test('complete: the notice and policy match the system — unsubscribing stops mail and keeps the record for the stated period', () => {
  const notice = html(React.createElement(SubscribeNotice, { id: 'n', facts: complete }))
  assert.match(notice, /id="n"/); assert.match(notice, /href="\/privacy"/); assert.match(notice, /TEST-30일 보관 후 파기/)
  assert.doesNotMatch(notice, /즉시 삭제/)
  const policy = html(React.createElement(PrivacyPolicy, { facts: complete }))
  for (const v of ['TEST-OPERATOR', 'TEST-REP', 'privacy@example.test', 'TEST-OFFICER', '2099-01-01', 'TEST-1년', 'TEST-탈퇴 시', 'TEST-월 1회 파기', 'TEST-REGION', 'Brevo', 'Anthropic', 'OpenAI', 'Google Analytics', '원문 IP는 저장하지 않음']) assert.ok(policy.includes(v), v)
  assert.doesNotMatch(policy, /null|undefined|\[운영자|\[법률/)
  assert.match(policy, /해지하면 발송이 바로 멈춥니다/); assert.doesNotMatch(policy, /해지[^.]*즉시 삭제/)
})

test('individual operation: no representative is required or shown; processors are listed with what and where', () => {
  const individual = { ...complete, operatorType: 'individual', representative: null }
  assert.deepEqual(privacy.missingPrivacyFacts(individual), [])
  const policy = html(React.createElement(PrivacyPolicy, { facts: individual }))
  assert.match(policy, /TEST-OPERATOR\(개인 운영\)/); assert.doesNotMatch(policy, /대표자/)
  for (const v of ['Supabase Inc.', 'Vercel Inc.', '미국(서버 처리)', 'Brevo', 'Google LLC', 'Anthropic PBC, OpenAI', '발송·열람·클릭 기록']) assert.ok(policy.includes(v), v)
  assert.doesNotMatch(policy, /null|undefined/)
})

test('replies: Brevo mail gets a reply-to only once a contact address is confirmed (newsletter@ cannot receive)', () => {
  assert.deepEqual(privacy.mailReplyTo(), {})
  assert.deepEqual(privacy.mailReplyTo(complete), { replyTo: { email: 'privacy@example.test', name: 'MarkLens' } })
  for (const f of ['src/app/api/confirm-subscription/route.ts', 'src/app/api/newsletter/send/route.ts', 'src/lib/newsletter/onboarding.ts']) assert.match(readFileSync(f, 'utf8'), /\.\.\.mailReplyTo\(\)/, f)
})

test('wiring: both subscribe forms carry the notice; inputs reference it only when it exists', () => {
  const inline = readFileSync('src/components/NewsletterInlineCta.tsx', 'utf8'), weekly = readFileSync('src/app/(public)/newsletter/NewsletterClient.tsx', 'utf8')
  assert.match(inline, /<SubscribeNotice id=\{noticeId\} \/>/); assert.match(inline, /aria-describedby=\{privacyReady\(\) \? noticeId : undefined\}/)
  assert.match(weekly, /<SubscribeNotice id="weekly-privacy-note" \/>/); assert.match(weekly, /privacyReady\(\) \? "weekly-note weekly-privacy-note" : "weekly-note"/)
})
