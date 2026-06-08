import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function formatContent(content: string): string {
  return content
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)
    .map(s => `<p style="margin:0 0 14px;font-size:15px;color:#1a1a1a;line-height:1.85;font-family:Georgia,'Times New Roman',serif;">${s.trim()}</p>`)
    .join("")
}

function buildSection(
  num: string,
  emoji: string,
  title: string,
  content: string,
  accentColor = "#4f46e5",
  bgColor = "#ffffff",
): string {
  return `
  <tr><td style="padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e5e5;background:${bgColor};">
      <tr>
        <td style="padding:4px 0 0;background:${accentColor};font-size:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:20px 24px 6px;">
          <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accentColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${num}</p>
          <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${emoji}&nbsp;${title}</p>
          ${formatContent(content)}
        </td>
      </tr>
      <tr><td style="height:16px;"></td></tr>
    </table>
  </td></tr>`
}

function buildHtml(issue: any): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })

  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? `Issue #${issueNumMatch[1]}` : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fafaf8;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- 상단 컬러 바 -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#4f46e5 0%,#7c3aed 50%,#ec4899 100%);font-size:0;">&nbsp;</td></tr>

  <!-- 헤더 -->
  <tr><td style="background:#0d0d0d;padding:36px 40px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#666;letter-spacing:0.18em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">MarkLens Weekly${issueNum ? ` &middot; ${issueNum}` : ""}</p>
    <h1 style="margin:8px 0 12px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${cleanTitle}</h1>
    <p style="margin:0;font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${today}</p>
  </td></tr>

  <!-- 목차 -->
  <tr><td style="padding:28px 32px 24px;background:#fafaf8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;border-radius:8px;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#888;letter-spacing:0.14em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">이번 호 목차</p>
      <p style="margin:0 0 5px;font-size:13px;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span style="color:#4f46e5;font-weight:700;">01</span>&nbsp;&nbsp;This Week's Signals</p>
      <p style="margin:0 0 5px;font-size:13px;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span style="color:#4f46e5;font-weight:700;">02</span>&nbsp;&nbsp;Case of the Week</p>
      <p style="margin:0 0 5px;font-size:13px;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span style="color:#4f46e5;font-weight:700;">03</span>&nbsp;&nbsp;AI Marketing Brief</p>
      <p style="margin:0 0 5px;font-size:13px;color:#7c3aed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span style="font-weight:700;">04</span>&nbsp;&nbsp;Portfolio Insight ✦</p>
      <p style="margin:0;font-size:13px;color:#16a34a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><span style="font-weight:700;">05</span>&nbsp;&nbsp;Career Lens ✦</p>
    </td></tr></table>
  </td></tr>

  <!-- 섹션들 -->
  ${issue.week_signals ? buildSection("01", "📡", "This Week's Signals", issue.week_signals, "#4f46e5") : ""}
  ${issue.case_of_week ? buildSection("02", "🔍", "Case of the Week", issue.case_of_week, "#0891b2") : ""}
  ${issue.ai_brief ? buildSection("03", "🤖", "AI Marketing Brief", issue.ai_brief, "#059669") : ""}
  ${issue.portfolio_insight ? buildSection("04", "📁", "Portfolio Insight", issue.portfolio_insight, "#7c3aed", "#faf5ff") : ""}
  ${issue.career_lens ? buildSection("05", "🎯", "Career Lens", issue.career_lens, "#16a34a", "#f0fdf4") : ""}

  <!-- CTA -->
  <tr><td style="padding:8px 32px 36px;text-align:center;">
    <a href="https://marklens.site/insights" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 구분선 -->
  <tr><td style="height:1px;background:#e5e2dc;"></td></tr>

  <!-- 푸터 -->
  <tr><td style="padding:24px 32px;text-align:center;background:#f4f1ec;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">MarkLens</p>
    <p style="margin:0 0 14px;font-size:11px;color:#999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;color:#bbb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <a href="https://marklens.site" style="color:#888;text-decoration:none;">marklens.site</a>
      &nbsp;&middot;&nbsp;
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

  return new Response(buildHtml(issue), { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
