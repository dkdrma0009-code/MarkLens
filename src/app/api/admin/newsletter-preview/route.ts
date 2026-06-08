import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"

function sentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

function signalsSection(content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:0 24px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:14px;overflow:hidden;">
      <tr><td style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed);font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:22px 26px 8px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4f46e5;${F}">📡 01 · This Week's Signals</p>
        <p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#ffffff;line-height:1.4;letter-spacing:-0.3px;${F}">${lead ?? ""}</p>
        ${rest.map(s => `<p style="margin:0 0 12px;font-size:14px;color:#aaa;line-height:1.8;${F}">${s}</p>`).join("")}
      </td></tr>
      <tr><td style="height:16px;"></td></tr>
    </table>
  </td></tr>`
}

function caseSection(content: string): string {
  const [lead, ...rest] = sentences(content)
  return `
  <tr><td style="padding:0 24px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:14px;overflow:hidden;border:1px solid #eeeeee;">
      <tr>
        <td style="width:4px;background:linear-gradient(180deg,#0891b2,#0e7490);border-radius:14px 0 0 14px;font-size:0;">&nbsp;</td>
        <td style="padding:22px 22px 18px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0891b2;${F}">🔍 02 · Case of the Week</p>
          <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0a0a0a;line-height:1.4;${F}">${lead ?? ""}</p>
          ${rest.map(s => `<p style="margin:0 0 10px;font-size:14px;color:#444;line-height:1.8;${F}">${s}</p>`).join("")}
        </td>
      </tr>
    </table>
  </td></tr>`
}

function aiSection(content: string): string {
  return `
  <tr><td style="padding:0 24px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:14px;overflow:hidden;border:1px solid #bbf7d0;">
      <tr><td style="padding:20px 22px 16px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#059669;${F}">🤖 03 · AI Marketing Brief</p>
        ${sentences(content).map(s => `<p style="margin:0 0 10px;font-size:14px;color:#1a4731;line-height:1.8;${F}">${s}</p>`).join("")}
      </td></tr>
    </table>
  </td></tr>`
}

function portfolioSection(content: string): string {
  return `
  <tr><td style="padding:0 24px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border-radius:14px;overflow:hidden;border:1px solid #e9d5ff;">
      <tr><td style="padding:20px 22px 16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c3aed;${F}">📁 04 · Portfolio Insight</p>
        <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;${F}">구독자 전용</p>
        ${sentences(content).map(s => `<p style="margin:0 0 10px;font-size:14px;color:#3b1f6e;line-height:1.8;${F}">${s}</p>`).join("")}
      </td></tr>
    </table>
  </td></tr>`
}

function careerSection(content: string): string {
  return `
  <tr><td style="padding:0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:14px;overflow:hidden;border:1px solid #fde68a;">
      <tr><td style="padding:20px 22px 16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#d97706;${F}">🎯 05 · Career Lens</p>
        <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;${F}">오늘의 액션</p>
        ${sentences(content).map(s => `<p style="margin:0 0 10px;font-size:14px;color:#78350f;line-height:1.8;${F}">${s}</p>`).join("")}
      </td></tr>
    </table>
  </td></tr>`
}

function buildHtml(issue: any, heroImage: string | null = null): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? issueNumMatch[1] : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eeebe6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeebe6;">
<tr><td align="center" style="padding:24px 12px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- 헤더 -->
  <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:32px 32px 28px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#555;letter-spacing:0.18em;text-transform:uppercase;${F}">MarkLens Weekly${issueNum ? ` &nbsp;·&nbsp; Issue #${issueNum}` : ""}</p>
        <h1 style="margin:10px 0 14px;font-size:26px;font-weight:900;color:#fff;line-height:1.3;letter-spacing:-0.5px;${F}">${cleanTitle}</h1>
        <p style="margin:0;font-size:11px;color:#555;${F}">${today}</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- 히어로 이미지 -->
  ${heroImage ? `<tr><td style="padding:0;background:#0a0a0a;"><img src="${heroImage}" alt="" width="600" style="width:100%;display:block;max-height:280px;object-fit:cover;opacity:0.92;"/></td></tr>` : ""}

  <!-- 본문 -->
  <tr><td style="background:#ffffff;padding:20px 0 8px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${issue.week_signals ? signalsSection(issue.week_signals) : ""}
      ${issue.case_of_week ? caseSection(issue.case_of_week) : ""}
      ${issue.ai_brief ? aiSection(issue.ai_brief) : ""}
      ${issue.portfolio_insight ? portfolioSection(issue.portfolio_insight) : ""}
      ${issue.career_lens ? careerSection(issue.career_lens) : ""}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#ffffff;padding:0 24px 32px;text-align:center;">
    <a href="https://marklens.site/insights"
      style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;${F}">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="background:#f0ede8;border-radius:0 0 16px 16px;border-top:1px solid #e0ddd8;padding:22px 24px;text-align:center;">
    <p style="margin:0 0 3px;font-size:13px;font-weight:800;color:#0a0a0a;${F}">MarkLens</p>
    <p style="margin:0 0 12px;font-size:11px;color:#bbb;${F}">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;${F}">
      <a href="https://marklens.site" style="color:#999;text-decoration:none;">marklens.site</a>
      &nbsp;·&nbsp;
      <span style="color:#bbb;">구독 취소</span>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const issueId = searchParams.get("id")
  if (!issueId) return new Response("id required", { status: 400 })

  const db = createAdminClient()
  const { data: issue } = await db.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return new Response("Not found", { status: 404 })

  const { data: imgData } = await db
    .from("articles")
    .select("image_url")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .single()
  const heroImage = (imgData as any)?.image_url ?? null

  return new Response(buildHtml(issue, heroImage), { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
