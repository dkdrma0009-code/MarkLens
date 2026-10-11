import type { NewsletterIssue, NewsletterVisual } from "@/types"
import { isHotlinkBlocked } from "@/lib/images"
import { buildTrackedUrl } from "@/lib/tracked-url"

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
const ACCENT = "#164BFF"
const SITE = "https://marklens.site"

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}

// Keep generated Unsplash attribution links, but never arbitrary caption HTML.
function photoCaption(value: string): string {
  return value.split(/(<a\s+href="[^"]*"[^>]*>[^<]*<\/a>)/gi).map(part => {
    const match = part.match(/^<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>$/i)
    const url = match && httpsUrl(match[1])
    return match && url ? `<a href="${escapeHtml(url)}" style="color:#595959;text-decoration:underline;">${escapeHtml(match[2])}</a>` : escapeHtml(part)
  }).join("")
}

function emailPhotoSrc(value: string): string | null {
  const safe = httpsUrl(value)
  if (!safe || isHotlinkBlocked(safe)) return null
  const url = new URL(safe)
  if (url.hostname === "images.unsplash.com") {
    for (const [key, val] of Object.entries({ w: "1184", q: "80", fm: "jpg", fit: "max" })) url.searchParams.set(key, val)
    return url.href
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(safe.replace(/^https:\/\//, ""))}&w=1184&output=jpg&q=80&maxage=7d`
}

function row(content: string, padding = "0 24px 24px", dark = false): string {
  return `<tr><td class="email-gutter" bgcolor="${dark ? "#111111" : "#ffffff"}" style="padding:${padding};background:${dark ? "#111111" : "#ffffff"};${F}word-break:keep-all;overflow-wrap:break-word;word-wrap:break-word;">${content}</td></tr>`
}
function label(text: string, dark = false): string {
  return `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1.5px;color:${dark ? "#bdbdbd" : ACCENT};${F}">${escapeHtml(text)}</p>`
}
function prose(text: string, dark = false): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.85;color:${dark ? "#eeeeee" : "#333333"};${F}">${escapeHtml(text)}</p>`
}
function renderVisual(v: NewsletterVisual, alt: string): string {
  let src: string | null = null
  let description = alt
  let caption = ""
  if (v.type === "typo_quote") {
    src = `${SITE}/api/newsletter/visual?type=quote&text=${encodeURIComponent(v.text)}`
    description = v.text
  } else if (v.type === "typo_stat") {
    src = `${SITE}/api/newsletter/visual?type=stat&number=${encodeURIComponent(v.number)}&label=${encodeURIComponent(v.label)}`
    description = `${v.number} — ${v.label}`
  } else {
    src = emailPhotoSrc(v.url)
    caption = v.caption ? photoCaption(v.caption) : ""
  }
  return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(description)}" width="592" style="width:100%;max-width:592px;height:auto;display:block;border:0;"/>${caption ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#595959;${F}">${caption}</p>` : ""}` : ""
}

function sentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

export function readingTime(issue: NewsletterIssue): number {
  const modern = [issue.intro, issue.topic_headline, issue.for_your_career,
    ...(issue.body_sections?.flatMap(s => s.paragraphs) ?? []), ...(issue.key_takeaways ?? [])]
  const legacy = [issue.week_signals, issue.case_of_week, issue.ai_brief, issue.portfolio_insight, issue.career_lens]
  const text = [...modern, ...legacy].filter(Boolean).join(" ")
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

function renderModernBody(issue: NewsletterIssue): string {
  const sections = (issue.body_sections ?? []).map((section, index) => {
    const heading = `<h2 style="margin:0 0 18px;font-size:${index === 0 ? 26 : 22}px;line-height:1.45;letter-spacing:-0.5px;color:#111111;${F}">${escapeHtml(section.subhead)}</h2>`
    return row(`${index === 0 ? label("MAIN STORY") : ""}${heading}${section.paragraphs.map(p => prose(p)).join("")}${section.visual ? renderVisual(section.visual, `${section.subhead} 관련 이미지`) : ""}`, index === 0 ? "32px 24px 28px" : "8px 24px 28px")
  }).join("")
  const signals = issue.key_takeaways?.length ? row(`${label("THIS WEEK’S SIGNALS", true)}<h2 style="margin:0 0 20px;font-size:24px;line-height:1.4;color:#ffffff;${F}">이번 호의 핵심 인사이트</h2>${issue.key_takeaways.map((take, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="36" valign="top" style="padding:16px 0;border-top:1px solid #444444;color:#bdbdbd;font-size:13px;${F}">${String(i + 1).padStart(2, "0")}</td><td valign="top" style="padding:16px 0;border-top:1px solid #444444;color:#ffffff;font-size:16px;line-height:1.75;${F}word-break:keep-all;overflow-wrap:break-word;">${escapeHtml(take)}</td></tr></table>`).join("")}`, "28px 24px", true) : ""
  const career = issue.for_your_career ? row(`${label("FROM TREND TO ACTION")}<h2 style="margin:0 0 18px;font-size:24px;line-height:1.4;color:#111111;${F}">실무와 커리어로 이어가기</h2>${prose(issue.for_your_career)}`, "32px 24px 12px") : ""
  return sections + signals + career
}

function renderLegacyBody(issue: NewsletterIssue): string {
  return [["THIS WEEK’S SIGNAL", issue.week_signals], ["CASE OF THE WEEK", issue.case_of_week],
    ["ACTION", issue.ai_brief], ["PORTFOLIO INSIGHT", issue.portfolio_insight], ["CAREER LENS", issue.career_lens]]
    .map(([name, content]) => {
      if (!content) return ""
      const [lead, ...rest] = sentences(content)
      return row(`${label(name!)}<h2 style="margin:0 0 16px;font-size:24px;line-height:1.5;color:#111111;${F}">${escapeHtml(lead ?? "")}</h2>${rest.map(p => prose(p)).join("")}`, "24px 24px 8px")
    }).join("")
}

// Shared by broadcast and authenticated admin preview. No delivery or data contract changes.
export function buildNewsletterHtml(issue: NewsletterIssue, { unsubscribeUrl }: { unsubscribeUrl?: string } = {}): string {
  const issueNum = Number.isSafeInteger(issue.issue_number) && issue.issue_number > 0 ? String(issue.issue_number) : issue.title.match(/^#(\d+)/)?.[1]
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()
  const date = new Date(issue.sent_at || issue.scheduled_at || issue.created_at)
  const dateLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })
  const destination = buildTrackedUrl({ path: "/insights", source: "newsletter", medium: "email", content: issueNum ? `weekly_${issueNum.padStart(3, "0")}` : "weekly_archive" })
  const preheader = (issue.intro || issue.topic_headline || cleanTitle).replace(/\s+/g, " ").trim()
  const unsubscribe = unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="display:inline-block;padding:12px 0;color:#595959;text-decoration:underline;">구독 취소</a>` : `<span style="color:#595959;">구독 취소 (개인별 링크는 발송 시 표시)</span>`
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/><title>${escapeHtml(cleanTitle)}</title>
<style>body{margin:0;padding:0;}table{border-collapse:collapse;}a{word-wrap:break-word;}@media screen and (max-width:480px){.email-shell{padding:0!important;}.email-gutter{padding-left:20px!important;padding-right:20px!important;}.email-title{font-size:28px!important;}}</style></head>
<body style="margin:0;padding:0;background:#f5f5f3;${F}">
<div style="display:none;font-size:1px;line-height:1px;color:#f5f5f3;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f3"><tr><td class="email-shell" align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:640px;table-layout:fixed;background:#ffffff;">
${row(`<a href="${SITE}" aria-label="MarkLens 홈페이지"><img src="${SITE}/brand/marklens-weekly.png" alt="MarkLens Weekly" width="248" style="display:block;width:248px;max-width:100%;height:auto;border:0;"/></a><p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#595959;letter-spacing:1px;${F}">MARKLENS WEEKLY${issueNum ? ` / ISSUE ${issueNum}` : ""}${dateLabel ? `<br/>${escapeHtml(dateLabel)}` : ""} · ${readingTime(issue)}분</p>`, "36px 24px 24px")}
${row(`<h1 class="email-title" style="margin:0;font-size:34px;line-height:1.35;letter-spacing:-1px;color:#111111;${F}">${escapeHtml(cleanTitle)}</h1>${issue.intro ? `<div style="margin-top:20px;">${prose(issue.intro)}</div>` : ""}${issue.topic_headline && issue.topic_headline !== cleanTitle ? `<p style="margin:24px 0 0;padding:18px 0;border-top:2px solid #111111;border-bottom:1px solid #d7d7d7;font-size:19px;line-height:1.65;font-weight:700;color:#111111;${F}">${escapeHtml(issue.topic_headline)}</p>` : ""}`, "8px 24px 0")}
${issue.topic_headline ? renderModernBody(issue) : renderLegacyBody(issue)}
${row(`${label("KEEP READING")}<h2 style="margin:0 0 20px;font-size:24px;line-height:1.5;color:#111111;${F}">트렌드를 다음 행동으로.</h2><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${ACCENT}" style="background:${ACCENT};mso-padding-alt:16px 24px;"><a href="${escapeHtml(destination)}" style="display:inline-block;padding:16px 24px;border:1px solid ${ACCENT};font-size:15px;line-height:1.4;font-weight:700;color:#ffffff;text-decoration:none;${F}">이번 주 인사이트 더 보기 →</a></td></tr></table>`, "32px 24px")}
${row(`<div style="border-top:1px solid #d7d7d7;padding-top:28px;"><a href="${SITE}"><img src="${SITE}/brand/marklens-wordmark.png" alt="MarkLens" width="120" height="23" style="display:block;width:120px;height:auto;border:0;"/></a><p style="margin:16px 0;font-size:13px;line-height:1.8;color:#595959;${F}">Where Marketing Trends Become Action<br/>Marketing × Trend × Intelligence</p><p style="margin:0;font-size:13px;line-height:1.8;${F}"><a href="${SITE}" style="display:inline-block;padding:12px 0;color:#595959;text-decoration:underline;">marklens.site</a> &nbsp;·&nbsp; ${unsubscribe}</p></div>`, "0 24px 32px")}
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`
}
