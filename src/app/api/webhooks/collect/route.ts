import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import Parser from "rss-parser"

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "MarkLens/1.0" },
})

function stripBom(str: string | null | undefined): string | null {
  if (!str) return str ?? null
  return str.replace(/^\uFEFF/, "").trim()
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MarkLens/1.0" },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 활성 RSS 소스 가져오기
  const { data: sources } = await supabase
    .from("rss_sources")
    .select("*")
    .eq("is_active", true)

  if (!sources || sources.length === 0) {
    return NextResponse.json({ message: "No active sources", collected: 0 })
  }

  let totalNew = 0
  const errors: string[] = []

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.rss_url)
      const items = feed.items.slice(0, 10) // 소스당 최신 10개

      for (const item of items) {
        if (!item.link || !item.title) continue

        // 중복 체크 후 삽입
        const { error } = await supabase
          .from("articles")
          .insert({
            title: item.title.trim(),
            url: item.link,
            source: source.slug,
            source_name: source.name,
            author: item.creator ?? item.author ?? null,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            raw_content: stripBom(item.contentSnippet ?? item.content ?? null),
            image_url: item.enclosure?.url ?? await fetchOgImage(item.link),
            status: "pending",
          })
          .select()

        if (!error) totalNew++
        // 중복(unique constraint)은 무시
      }

      // last_fetched_at 업데이트
      await supabase
        .from("rss_sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", source.id)

    } catch (err: any) {
      errors.push(`${source.name}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    collected: totalNew,
    sources: sources.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
