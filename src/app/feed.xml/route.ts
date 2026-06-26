import { createPublicClient } from "@/lib/supabase/server"

// 인사이트 RSS 2.0 피드 — RSS 리더·아그리게이터·자동화 도구로 콘텐츠 신디케이션(도달 확대).
// 쿠키 없는 공개 클라이언트라 ISR 캐시됨.
export const revalidate = 3600

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const supabase = createPublicClient()
  const { data } = await supabase
    .from("insights")
    .select("slug, hook, summary, category, created_at, article:articles!inner(status, title)")
    .eq("article.status", "published")
    .order("created_at", { ascending: false })
    .limit(50)

  const rows = (data ?? []) as Array<{ slug: string; hook?: string; summary?: string; category?: string; created_at: string; article?: { title?: string } }>
  const items = rows
    .map((i) => {
      const url = `${base}/insights/${i.slug}`
      const title = i.hook || i.article?.title || "MarkLens 인사이트"
      const pub = new Date(i.created_at).toUTCString()
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${pub}</pubDate>
      ${i.category ? `<category>${esc(i.category)}</category>` : ""}
      <description>${esc(i.summary ?? "")}</description>
    </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MarkLens — 마케팅 트렌드 인사이트</title>
    <link>${base}</link>
    <description>글로벌 마케팅 트렌드를 한국 마케터·취준생 관점으로 풀어내는 인사이트</description>
    <language>ko-KR</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
