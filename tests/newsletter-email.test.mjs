import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newsletterRenderer } from '../tools/newsletter-preview.mjs'
import { newsletterFixture, newsletterVariants } from './fixtures/newsletter-email.mjs'
const { buildNewsletterHtml } = newsletterRenderer()
test('all stored modern and legacy copy is preserved without invented sections', () => {
  for (const issue of Object.values(newsletterVariants)) {
    const html = buildNewsletterHtml(issue)
    for (const text of [...(issue.body_sections?.flatMap(s => [s.subhead, ...s.paragraphs]) || []), ...(issue.key_takeaways || []), issue.for_your_career, issue.week_signals, issue.case_of_week, issue.ai_brief, issue.portfolio_insight, issue.career_lens].filter(Boolean)) assert.ok(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").includes(text))
    assert.ok(!html.includes('MORE INSIGHTS'))
    assert.ok(!/<script|display:flex|display:grid|border-radius|linear-gradient/.test(html))
  }
  assert.ok(!buildNewsletterHtml(newsletterVariants.sparse).includes('FROM TREND TO ACTION'))
  assert.ok(!buildNewsletterHtml(newsletterVariants.sparse).includes('THIS WEEK’S SIGNALS'))
})
test('canonical PNG, production URLs, stable UTM, deterministic date and unsubscribe survive', () => {
  const url = 'https://marklens.site/api/unsubscribe?email=test%40example.invalid&token=TEST'
  const html = buildNewsletterHtml(newsletterFixture, { unsubscribeUrl: url })
  assert.ok(html.includes('marklens-weekly.png')); assert.ok(html.includes('marklens-wordmark.png'))
  assert.ok(html.includes('#164BFF')); assert.ok(!/#0954F9|#6366f1/i.test(html))
  assert.ok(html.includes('utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=marklens_v2_relaunch&amp;utm_content=weekly_012'))
  assert.ok(html.includes('2026년 10월 11일')); assert.ok(html.includes(url.replace('&', '&amp;')))
  assert.equal(buildNewsletterHtml(newsletterFixture), buildNewsletterHtml(newsletterFixture))
  for (const match of html.matchAll(/<img src="([^"]+)" alt="([^"]*)"/g)) { assert.ok(match[1].startsWith('https://')); assert.ok(match[2].length) }
})
test('copy/attributes are escaped, image policy and credited links retained', () => {
  const html = buildNewsletterHtml({ ...newsletterFixture, title: '<script>alert(1)</script>', intro: 'A & B', body_sections: [{ subhead: 'Safe', paragraphs: ['<img onerror="bad">'], visual: { type: 'photo', url: 'javascript:bad', caption: 'bad' } }] })
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;img onerror=')); assert.ok(html.includes('A &amp; B')); assert.ok(!html.includes('src="javascript:'))
  const photo = buildNewsletterHtml({ ...newsletterFixture, body_sections: [{ subhead: 'Photo', paragraphs: [], visual: { type: 'photo', url: 'https://images.unsplash.com/example', caption: 'Photo by <a href="https://unsplash.com/author?utm_source=marklens&utm_medium=referral" style="color:#aaa">Author</a>' } }] })
  assert.ok(photo.includes('href="https://unsplash.com/author?utm_source=marklens&amp;utm_medium=referral"'))
  assert.ok(!buildNewsletterHtml({ ...newsletterFixture, body_sections: [{ subhead: 'Blocked', paragraphs: [], visual: { type: 'photo', url: 'https://cdn.musebyclios.com/photo.jpg' } }] }).includes('musebyclios.com'))
})
