import type { NewsletterIssue, NewsletterVisual } from "@/types"
import { isHotlinkBlocked, weservThumb } from "@/lib/images"

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
// 포인트 컬러는 단 1개만 — 흑백 기조에 절제된 인디고. 인용구·소제목·링크·정리박스·버튼에 일관 사용.
const ACCENT = "#4f46e5"
const SITE = "https://marklens.site"

// 본문 비주얼 — 타이포 카드(Satori 라우트 이미지) 또는 합법 사진. 이메일에서 <img>로 안전 표시.
function renderVisual(v: NewsletterVisual): string {
  let imgSrc = ""
  let caption = ""
  if (v.type === "typo_quote") {
    imgSrc = `${SITE}/api/newsletter/visual?type=quote&text=${encodeURIComponent(v.text)}`
  } else if (v.type === "typo_stat") {
    imgSrc = `${SITE}/api/newsletter/visual?type=stat&number=${encodeURIComponent(v.number)}&label=${encodeURIComponent(v.label)}`
  } else if (v.type === "photo") {
    if (!v.url || isHotlinkBlocked(v.url)) return "" // 차단 매체는 삽입 안 함(정책 일관)
    imgSrc = weservThumb(v.url, 600)
    caption = v.caption ?? ""
  }
  if (!imgSrc) return ""
  return `
  <tr><td style="padding:8px 32px 18px;">
    <img src="${imgSrc}" alt="" width="536" style="width:100%;max-width:536px;display:block;border-radius:12px;"/>
    ${caption ? `<p style="margin:8px 0 0;font-size:11px;color:#aaa;text-align:center;${F}">${caption}</p>` : ""}
  </td></tr>`
}

function sentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

export function readingTime(issue: NewsletterIssue): number {
  const modern = [
    issue.intro, issue.topic_headline, issue.for_your_career,
    ...(issue.body_sections?.flatMap(s => s.paragraphs) ?? []),
    ...(issue.key_takeaways ?? []),
  ]
  const legacy = [issue.week_signals, issue.case_of_week, issue.ai_brief, issue.portfolio_insight, issue.career_lens]
  const text = [...modern, ...legacy].filter(Boolean).join(" ")
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

// ── 신규: 한 주제 깊이형 본문 ──
function renderModernBody(issue: NewsletterIssue): string {
  // 인용구 박스 (이번 주의 단 하나)
  const quote = issue.topic_headline ? `
  <tr><td style="padding:8px 28px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border-radius:14px;">
      <tr><td style="padding:30px 28px;">
        <span style="font-size:40px;line-height:0;color:${ACCENT};font-weight:900;${F}">&ldquo;</span>
        <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.45;letter-spacing:-0.3px;${F}">${issue.topic_headline}</p>
      </td></tr>
    </table>
  </td></tr>` : ""

  // 본문 소단락 (+ 섹션에 visual 있으면 단락 뒤에 삽입)
  const body = (issue.body_sections ?? []).map(s => `
  <tr><td style="padding:14px 32px 6px;">
    <p style="margin:0;font-size:18px;font-weight:800;color:#111;line-height:1.4;${F}">👉 ${s.subhead}</p>
  </td></tr>
  ${s.paragraphs.map(p => `<tr><td style="padding:0 32px 14px;"><p style="margin:0;font-size:16px;color:#333;line-height:1.85;${F}">${p}</p></td></tr>`).join("")}
  ${s.visual ? renderVisual(s.visual) : ""}`).join("")

  // 핵심 정리 박스
  const takeaways = (issue.key_takeaways?.length) ? `
  <tr><td style="padding:20px 28px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4fb;border-radius:12px;border-left:3px solid ${ACCENT};">
      <tr><td style="padding:22px 24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:800;color:${ACCENT};letter-spacing:0.06em;${F}">이번 주 핵심 인사이트</p>
        ${issue.key_takeaways.map(t => `<p style="margin:0 0 9px;font-size:15px;color:#222;line-height:1.6;${F}">· ${t}</p>`).join("")}
      </td></tr>
    </table>
  </td></tr>` : ""

  // For Your Career (취준 응축)
  const career = issue.for_your_career ? `
  <tr><td style="padding:24px 32px 8px;">
    <hr style="border:none;border-top:1px solid #eee;margin:0 0 22px;"/>
    <p style="margin:0 0 10px;font-size:12px;font-weight:800;color:${ACCENT};letter-spacing:0.1em;${F}">FOR YOUR CAREER</p>
    <p style="margin:0;font-size:15px;color:#333;line-height:1.85;${F}">${issue.for_your_career}</p>
  </td></tr>` : ""

  return quote + body + takeaways + career
}

// ── 폴백: 구 5섹션 호 (과거 발송 이력 렌더용, 색 없이 단순 텍스트) ──
function legacySection(label: string, content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:18px 32px 4px;">
    <p style="margin:0 0 10px;font-size:12px;font-weight:800;color:${ACCENT};letter-spacing:0.06em;${F}">${label}</p>
    <p style="margin:0 0 12px;font-size:17px;font-weight:800;color:#111;line-height:1.5;${F}">${lead ?? ""}</p>
    ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.85;${F}">${s}</p>`).join("")}
  </td></tr>`
}

function renderLegacyBody(issue: NewsletterIssue): string {
  return [
    issue.week_signals ? legacySection("THIS WEEK'S SIGNAL", issue.week_signals) : "",
    issue.case_of_week ? legacySection("CASE OF THE WEEK", issue.case_of_week) : "",
    issue.ai_brief ? legacySection("ACTION", issue.ai_brief) : "",
    issue.portfolio_insight ? legacySection("PORTFOLIO INSIGHT", issue.portfolio_insight) : "",
    issue.career_lens ? legacySection("CAREER LENS", issue.career_lens) : "",
  ].join("")
}

// 발송용·미리보기용 공유 빌더. topic_headline 있으면 신규, 없으면 과거 호 폴백.
export function buildNewsletterHtml(
  issue: NewsletterIssue,
  { unsubscribeUrl }: { unsubscribeUrl?: string; heroImage?: string | null } = {}
): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? issueNumMatch[1] : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()
  const mins = readingTime(issue)

  const isModern = !!issue.topic_headline
  const bodyHtml = isModern ? renderModernBody(issue) : renderLegacyBody(issue)

  const unsubscribe = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#888;text-decoration:none;">구독 취소</a>`
    : `<span style="color:#bbb;">구독 취소</span>`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eceae6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eceae6;">
<tr><td align="center" style="padding:24px 12px 40px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

  <!-- 헤더: 검정 배경 + 강렬한 워드마크 -->
  <tr><td style="background:#0d0d0d;padding:40px 32px 32px;text-align:center;">
    <p style="margin:0 0 14px;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-1px;${F}">MarkLens<span style="color:${ACCENT};">.</span></p>
    <p style="margin:0;font-size:11px;font-weight:600;color:#777;letter-spacing:0.18em;text-transform:uppercase;${F}">Weekly${issueNum ? ` · Issue #${issueNum}` : ""} &nbsp;·&nbsp; ${today} &nbsp;·&nbsp; ${mins}분</p>
  </td></tr>

  <!-- 제목 -->
  <tr><td style="padding:30px 32px 8px;">
    <h1 style="margin:0;font-size:26px;font-weight:900;color:#0d0d0d;line-height:1.3;letter-spacing:-0.5px;${F}">${cleanTitle}</h1>
  </td></tr>

  <!-- 인사말 -->
  ${issue.intro ? `<tr><td style="padding:10px 32px 18px;">
    <p style="margin:0;font-size:15px;color:#555;line-height:1.9;${F}">${issue.intro}</p>
  </td></tr>` : ""}

  <!-- 본문 -->
  ${bodyHtml}

  <!-- 푸터 CTA -->
  <tr><td style="padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f9;border-radius:14px;">
      <tr><td style="padding:26px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#111;${F}">이번 호, 도움이 되셨나요?</p>
        <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.7;${F}">마케팅 준비하는 친구에게 이 메일을 전달해 주세요.</p>
        <a href="https://marklens.site/insights?utm_source=newsletter&utm_medium=email"
          style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:13px 32px;border-radius:100px;${F}">
          사이트에서 더 보기 →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="background:#ffffff;border-top:1px solid #f0f0f0;padding:22px 24px 28px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#0d0d0d;${F}">MarkLens<span style="color:${ACCENT};">.</span></p>
    <p style="margin:0 0 12px;font-size:11px;color:#aaa;${F}">홈페이지보다 메일로 먼저 받아보세요</p>
    <p style="margin:0;font-size:11px;${F}">
      <a href="https://marklens.site" style="color:#888;text-decoration:none;">marklens.site</a>
      &nbsp;·&nbsp;
      ${unsubscribe}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
