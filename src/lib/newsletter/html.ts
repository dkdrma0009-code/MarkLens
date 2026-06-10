import type { NewsletterIssue } from "@/types"

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"

function sentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

export function readingTime(issue: NewsletterIssue): number {
  const text = [issue.intro, issue.week_signals, issue.case_of_week, issue.ai_brief].filter(Boolean).join(" ")
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

function signalSection(content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:28px 28px 4px;text-align:center;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="background:#6366f1;border-radius:100px;padding:9px 24px;">
        <span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:0.04em;${F}">📡 This Week's Signal</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 28px 20px;">
    <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:#111;line-height:1.5;letter-spacing:-0.3px;${F}">${lead ?? ""}</p>
    ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.85;${F}">${s}</p>`).join("")}
  </td></tr>
  <tr><td style="padding:0 28px;"><hr style="border:none;border-top:1px dashed #e0e0e0;margin:0;"/></td></tr>`
}

function caseSection(content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:20px 28px 4px;text-align:center;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="background:#0891b2;border-radius:100px;padding:9px 24px;">
        <span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:0.04em;${F}">🔍 Case of the Week</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 28px 20px;">
    <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:#111;line-height:1.5;${F}">${lead ?? ""}</p>
    ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.85;${F}">${s}</p>`).join("")}
  </td></tr>
  <tr><td style="padding:0 28px;"><hr style="border:none;border-top:1px dashed #e0e0e0;margin:0;"/></td></tr>`
}

function actionSection(content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:20px 28px 4px;text-align:center;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="background:#d97706;border-radius:100px;padding:9px 24px;">
        <span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:0.04em;${F}">🎯 Action of the Week</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:6px 28px 2px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#b45309;font-weight:600;${F}">⏱ 오늘 30분 안에 할 수 있어요</p>
  </td></tr>
  <tr><td style="padding:12px 28px 28px;">
    <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:#78350f;line-height:1.5;${F}">${lead ?? ""}</p>
    ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#92400e;line-height:1.85;${F}">${s}</p>`).join("")}
  </td></tr>`
}

// 발송용(unsubscribeUrl 전달)과 미리보기용(미전달 → 비활성 표시)이 공유하는 단일 빌더.
export function buildNewsletterHtml(
  issue: NewsletterIssue,
  { unsubscribeUrl, heroImage = null }: { unsubscribeUrl?: string; heroImage?: string | null } = {}
): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? issueNumMatch[1] : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()
  const mins = readingTime(issue)

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
<body style="margin:0;padding:0;background:#e8e5e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8e5e0;">
<tr><td align="center" style="padding:24px 12px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- 헤더 -->
  <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#4a4a4a;letter-spacing:0.18em;text-transform:uppercase;${F}">MarkLens Weekly${issueNum ? ` · Issue #${issueNum}` : ""}</p>
    <h1 style="margin:10px 0 14px;font-size:26px;font-weight:900;color:#ffffff;line-height:1.3;letter-spacing:-0.5px;${F}">${cleanTitle}</h1>
    <p style="margin:0;font-size:11px;color:#4a4a4a;${F}">${today} &nbsp;·&nbsp; 읽는 시간 약 ${mins}분</p>
  </td></tr>

  <!-- 히어로 이미지 -->
  ${heroImage ? `<tr><td style="padding:0;background:#0d0d0d;"><img src="${heroImage}" alt="" width="600" style="width:100%;display:block;max-height:260px;object-fit:cover;"/></td></tr>` : ""}

  <!-- 에디터 인트로 -->
  ${issue.intro ? `<tr><td style="background:#ffffff;padding:22px 28px 18px;border-bottom:1px solid #f0f0f0;">
    <p style="margin:0;font-size:15px;color:#333;line-height:1.9;${F}">${issue.intro}</p>
  </td></tr>` : ""}

  <!-- 본문 (3섹션, 흰 배경) -->
  <tr><td style="background:#ffffff;padding:4px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${issue.week_signals ? signalSection(issue.week_signals) : ""}
      ${issue.case_of_week ? caseSection(issue.case_of_week) : ""}
      ${issue.ai_brief ? actionSection(issue.ai_brief) : ""}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#ffffff;padding:12px 28px 36px;text-align:center;">
    <a href="https://marklens.site/insights"
      style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;${F}">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="background:#e8e5e0;border-radius:0 0 16px 16px;border-top:1px solid #d8d5d0;padding:22px 24px;text-align:center;">
    <p style="margin:0 0 3px;font-size:13px;font-weight:800;color:#0d0d0d;${F}">MarkLens</p>
    <p style="margin:0 0 12px;font-size:11px;color:#aaa;${F}">Where Marketing Trends Become Action</p>
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
