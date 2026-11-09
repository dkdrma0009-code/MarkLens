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
  operatorType: 'business', operator: 'TEST-OPERATOR', representative: 'TEST-REP', contactEmail: 'privacy@example.test', contactInboxVerified: true, privacyOfficer: 'TEST-OFFICER', effectiveDate: '2099-01-01',
  retention: { subscribers: 'TEST-해지 즉시', newsletterEvents: 'TEST-90일', members: 'TEST-탈퇴 시', feedback: 'TEST-1년', aiUsage: 'TEST-30일', inquiries: 'TEST-처리 후 6개월' },
  disposalProcess: 'TEST-매일 자동 파기', lawfulRetention: 'TEST-법령 보관 없음', databaseRegion: 'TEST-REGION', marketingConsent: 'notice-only', overseasTransferReviewed: true, geminiPaidConfirmed: true,
}
const html = el => renderToStaticMarkup(el)

const pageMocks = (lib = privacy) => ({ 'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } }, '@/lib/legal/privacy': lib, '@/components/legal/PrivacyPolicy': { default: PrivacyPolicy }, '@/components/legal/PrivacyPolicy20261025': { default: load('src/components/legal/PrivacyPolicy20261025.tsx', mocks).default } })
const IN_FORCE = /시행일: 2026-10-25/, REVISION_ONLY = /제28조의8제1항제3호/

test('P9E: an unconfirmed revision never hides the policy — /privacy, the archive, the footer link and the subscribe notice stay public', () => {
  const current = html(load('src/app/(public)/privacy/page.tsx', pageMocks()).default())
  assert.match(current, IN_FORCE); assert.doesNotMatch(current, REVISION_ONLY); assert.doesNotMatch(current, /null|undefined/)
  assert.match(html(load('src/app/(public)/privacy/2026-10-25/page.tsx', pageMocks()).default()), IN_FORCE)
  const footer = load('src/components/layout/Footer.tsx', { 'next/link': { __esModule: true, default: Link }, '@/lib/brand/WordmarkSvg': { __esModule: true, default: () => null }, './navigation': { CAREER_FEATURES: [] }, '@/lib/legal/privacy': privacy }).default
  assert.match(html(React.createElement(footer)), /href="\/privacy"/)
  const notice = html(React.createElement(SubscribeNotice, { id: 'n' }))
  assert.match(notice, /href="\/privacy"/); assert.doesNotMatch(notice, /null|undefined/)
})

test('P9E revision: shown only when the date, the transfer review and the Gemini paid tier are all confirmed; any one missing keeps the policy in force', () => {
  // Officer listing = the handling channel (Art. 30(1)6: a name OR a department with a contact; the name stays private).
  assert.deepEqual(privacy.missingPrivacyFacts(), ['시행일', '국외 이전 고지 법률 검토', 'Gemini 유료 등급 확인'])
  assert.equal(privacy.PRIVACY_FACTS.privacyOfficer, 'MarkLens 개인정보 담당'); assert.equal(privacy.PRIVACY_FACTS.effectiveDate, null)
  const confirmed = { ...privacy.PRIVACY_FACTS, effectiveDate: '2099-01-01', overseasTransferReviewed: true, geminiPaidConfirmed: true }
  const render = facts => html(load('src/app/(public)/privacy/page.tsx', pageMocks({ ...privacy, PRIVACY_FACTS: facts, privacyRevisionReady: () => privacy.privacyRevisionReady(facts) })).default())
  const revised = render(confirmed)
  assert.match(revised, /시행일: 2099-01-01/); assert.match(revised, REVISION_ONLY)
  for (const unset of [{ effectiveDate: null }, { overseasTransferReviewed: false }, { geminiPaidConfirmed: false }]) {
    const kept = render({ ...confirmed, ...unset })
    assert.match(kept, IN_FORCE); assert.doesNotMatch(kept, REVISION_ONLY); assert.doesNotMatch(kept, /학습에 쓰지 않습니다|Google 55일/)
  }
})

test('readiness: every fact counts; a separate marketing consent blocks publishing until its UI exists', () => {
  assert.deepEqual(privacy.missingPrivacyFacts(complete), [])
  assert.equal(privacy.privacyRevisionReady(complete), true)
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, geminiPaidConfirmed: false }), ['Gemini 유료 등급 확인'])
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, disposalProcess: null }), ['보유 기간 경과 기록 파기 절차'])
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, marketingConsent: 'separate-consent' }), ['광고성 정보 별도 동의 UI(미구현)'])
  assert.deepEqual(privacy.missingPrivacyFacts({ ...complete, overseasTransferReviewed: false }), ['국외 이전 고지 법률 검토'])
})

test('complete: the notice and policy match the system — unsubscribing deletes the subscription at once', () => {
  const notice = html(React.createElement(SubscribeNotice, { id: 'n', facts: complete }))
  assert.match(notice, /id="n"/); assert.match(notice, /href="\/privacy"/); assert.match(notice, /보관: TEST-해지 즉시./)
  const policy = html(React.createElement(PrivacyPolicy, { facts: complete }))
  for (const v of ['TEST-OPERATOR', 'TEST-REP', 'privacy@example.test', 'TEST-OFFICER', '2099-01-01', 'TEST-1년', 'TEST-탈퇴 시', 'TEST-90일', 'TEST-매일 자동 파기', 'TEST-법령 보관 없음', 'TEST-REGION', 'privacy@supabase.com', 'privacy@vercel.com', 'dpo@brevo.com', 'privacy@openai.com', 'Brevo', 'Anthropic', 'OpenAI', 'Google Analytics', '원문 IP는 저장하지 않음']) assert.ok(policy.includes(v), v)
  assert.doesNotMatch(policy, /null|undefined|\[운영자|\[법률/)
  assert.match(policy, /구독 해지 링크로 바로 해지되고 구독 정보도 함께 삭제됩니다/); assert.match(policy, /쿠키 저장을 거부/); assert.match(policy, /광고를 싣지 않습니다/)
})

test('P9D revision: what the law and the 2026 PIPC guideline ask for is on the page; the 2026-10-25 version stays reachable', () => {
  const policy = html(React.createElement(PrivacyPolicy, { facts: complete }))
  // Enforcement Decree Art. 31(1)2: the legal basis of the transfer; Act Art. 28-8(2)4: the recipients' retention.
  for (const v of ['제28조의8제1항제3호', '암호화된 네트워크(HTTPS)', 'Google 55일', 'Anthropic 30일 이내', 'OpenAI 최대 30일', 'AI 모델 학습에 쓰지 않습니다']) assert.ok(policy.includes(v), v)
  for (const v of ['자기소개서·포트폴리오', '브라우저 안에서만 처리되며', '내려받은 파일은 이용자 기기에', '브라우저 제공자의 서버로', '주민등록번호, 건강 정보', '2099-01-01부터 적용', 'href="/privacy/2026-10-25"']) assert.ok(policy.includes(v), v)
  const archived = html(React.createElement(load('src/components/legal/PrivacyPolicy20261025.tsx', mocks).default))
  assert.match(archived, /시행일: 2026-10-25/); assert.doesNotMatch(archived, /제28조의8제1항제3호|자기소개서/)
})

test('individual operation: no representative is required or shown; processors are listed with what and where', () => {
  const individual = { ...complete, operatorType: 'individual', representative: null }
  assert.deepEqual(privacy.missingPrivacyFacts(individual), [])
  const policy = html(React.createElement(PrivacyPolicy, { facts: individual }))
  assert.match(policy, /TEST-OPERATOR\(개인 운영\)/); assert.doesNotMatch(policy, /대표자/)
  for (const v of ['Supabase Inc.', 'Vercel Inc.', '미국(서버 처리)', 'Brevo SAS', 'Google LLC', 'Anthropic PBC', 'OpenAI, L.L.C.', 'ImprovMX Incorporation', 'NAVER Corp.', '전달 기록 7일 후 삭제', 'TEST-처리 후 6개월', '발송·열람·클릭']) assert.ok(policy.includes(v), v)
  assert.doesNotMatch(policy, /null|undefined/)
})

test('replies: Brevo mail carries the contact address as reply-to, and nothing when there is none', () => {
  assert.deepEqual(privacy.mailReplyTo(), { replyTo: { email: 'newsletter@marklens.site', name: 'MarkLens' } })
  assert.deepEqual(privacy.mailReplyTo({ ...complete, contactEmail: null }), {})
  assert.deepEqual(privacy.mailReplyTo(complete), { replyTo: { email: 'privacy@example.test', name: 'MarkLens' } })
  for (const f of ['src/app/api/confirm-subscription/route.ts', 'src/app/api/newsletter/send/route.ts', 'src/lib/newsletter/onboarding.ts']) assert.match(readFileSync(f, 'utf8'), /\.\.\.mailReplyTo\(\)/, f)
})

test('wiring: both subscribe forms carry the notice; inputs reference it only when it exists', () => {
  const inline = readFileSync('src/components/NewsletterInlineCta.tsx', 'utf8'), weekly = readFileSync('src/app/(public)/newsletter/NewsletterClient.tsx', 'utf8')
  assert.match(inline, /<SubscribeNotice id=\{noticeId\} \/>/); assert.match(inline, /aria-describedby=\{noticeId\}/)
  assert.match(weekly, /<SubscribeNotice id="weekly-privacy-note" \/>/); assert.match(weekly, /aria-describedby="weekly-note weekly-privacy-note"/)
})
