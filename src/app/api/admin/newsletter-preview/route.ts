import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

function formatContent(content: string): string {
  return content
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)
    .map(s => `<p style="margin:0 0 12px;font-size:15px;color:#222;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${s.trim()}</p>`)
    .join("")
}

function buildSection(
  num: string,
  emoji: string,
  title: string,
  content: string,
  accentColor = "#4f46e5",
  bgColor = "#ffffff",
  imageUrl?: string | null,
): string {
  return `
  <tr><td style="padding:0 28px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e8e8e4;background:${bgColor};">
      <tr><td style="height:3px;background:${accentColor};font-size:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:18px 22px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:28px;vertical-align:top;">
                <span style="font-size:18px;line-height:1;">${emoji}</span>
              </td>
              <td style="vertical-align:top;padding-left:6px;">
                <p style="margin:0 0 1px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accentColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${num}</p>
                <p style="margin:0 0 14px;font-size:16px;font-weight:800;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${title}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${imageUrl ? `<tr><td style="padding:0;"><img src="${imageUrl}" alt="" width="600" style="width:100%;display:block;object-fit:cover;max-height:220px;"/></td></tr>` : ""}
      <tr>
        <td style="padding:${imageUrl ? "16px" : "0"} 22px 16px;">
          ${formatContent(content)}
        </td>
      </tr>
    </table>
  </td></tr>`
}

function buildHtml(issue: any, caseImage: string | null = null): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? issueNumMatch[1] : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;">
<tr><td align="center" style="padding:28px 12px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

  <!-- 헤더 -->
  <tr><td style="padding:0;background:#0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="height:5px;background:#4f46e5;font-size:0;">&nbsp;</td>
        <td style="height:5px;background:#7c3aed;font-size:0;">&nbsp;</td>
        <td style="height:5px;background:#ec4899;font-size:0;">&nbsp;</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 28px;text-align:center;">
          <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#555;letter-spacing:0.2em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">MarkLens Weekly${issueNum ? ` · Issue #${issueNum}` : ""}</p>
          <h1 style="margin:10px 0 14px;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${cleanTitle}</h1>
          <p style="margin:0;font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${today}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- 섹션 시작 간격 -->
  <tr><td style="height:24px;background:#ffffff;"></td></tr>

  <!-- 섹션들 -->
  ${issue.week_signals ? buildSection("01", "📡", "This Week's Signals", issue.week_signals, "#4f46e5") : ""}
  ${issue.case_of_week ? buildSection("02", "🔍", "Case of the Week", issue.case_of_week, "#0891b2", "#ffffff", caseImage) : ""}
  ${issue.ai_brief ? buildSection("03", "🤖", "AI Marketing Brief", issue.ai_brief, "#059669") : ""}
  ${issue.portfolio_insight ? buildSection("04", "📁", "Portfolio Insight", issue.portfolio_insight, "#7c3aed", "#faf5ff") : ""}
  ${issue.career_lens ? buildSection("05", "🎯", "Career Lens", issue.career_lens, "#16a34a", "#f0fdf4") : ""}

  <!-- CTA -->
  <tr><td style="padding:4px 28px 32px;text-align:center;">
    <a href="https://marklens.site/insights" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="padding:20px 28px 28px;text-align:center;background:#f4f1ec;border-radius:0 0 16px 16px;border-top:1px solid #e5e2dc;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">MarkLens</p>
    <p style="margin:0 0 12px;font-size:11px;color:#aaa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;color:#bbb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <a href="https://marklens.site" style="color:#888;text-decoration:none;">marklens.site</a>
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
    .from("insights")
    .select("article:articles!inner(image_url)")
    .eq("articles.status", "published")
    .not("articles.image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const caseImage = (imgData as any)?.article?.image_url ?? null

  return new Response(buildHtml(issue, caseImage), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
