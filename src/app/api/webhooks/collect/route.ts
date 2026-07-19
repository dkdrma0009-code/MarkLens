import { createAdminClient } from "@/lib/supabase/admin"
import { isHotlinkBlocked } from "@/lib/images"
import { NextResponse } from "next/server"
import Parser from "rss-parser"

const CAMPAIGN_SLUGS = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

// ── 유사 제목 근접 중복 방지 ──
// URL은 다르지만 같은 사건을 재보도하거나, 정기 리포트가 달마다 거의 같은 제목으로 반복되는 경우
// (예: "Cable News Ratings for May/June 2026")를 제목 토큰 자카드로 걸러낸다. 주제만 비슷하고
// 제목이 다른 기사는 안 걸린다(오탐 방지).
const STOP = new Set(["the", "a", "an", "of", "for", "to", "in", "on", "and", "is", "are", "with", "this", "that", "how", "why", "new", "its", "by", "at", "as", "from", "was", "were", "be", "you", "your", "not", "has", "have", "will", "can", "it", "or", "here", "what", "who"])
function titleTokens(t: string): Set<string> {
  return new Set(
    t.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w))
  )
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}
const SIM_THRESHOLD = 0.6

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "MarkLens/1.0" },
})

// Fix bare boolean attributes (valid HTML but invalid XML), e.g. <img loading> → <img loading="loading">
function fixXmlAttributes(xml: string): string {
  return xml.replace(/<[^>]+>/g, (tag) =>
    tag.replace(/(\s+)([a-zA-Z][a-zA-Z0-9_:-]*)(?!\s*=)(?=[\s\/>])/g, '$1$2="$2"')
  )
}

async function parseRssFeed(url: string) {
  try {
    return await parser.parseURL(url)
  } catch {
    const res = await fetch(url, {
      headers: { "User-Agent": "MarkLens/1.0" },
      signal: AbortSignal.timeout(10000),
    })
    const text = fixXmlAttributes(await res.text())
    return await parser.parseString(text)
  }
}

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

  // 근접 중복 판정용 — 최근 30일 제목 토큰셋 (신규 삽입분도 이 배열에 누적해 같은 실행 내 중복도 차단)
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: recentArts } = await supabase.from("articles").select("title").gte("created_at", since).limit(600)
  const seenTitles: Set<string>[] = (recentArts ?? []).map(a => titleTokens(a.title ?? "")).filter(s => s.size > 0)

  let totalNew = 0
  let skippedDup = 0
  const errors: string[] = []

  for (const source of sources) {
    try {
      const feed = await parseRssFeed(source.rss_url)
      const items = feed.items.slice(0, 10).filter(item => item.link && item.title)

      // OG 이미지를 병렬로 fetch (차단 도메인은 null 처리 — 공용 목록 재사용)
      const images = await Promise.all(
        items.map(item => {
          const enc = item.enclosure?.url
          if (enc && !isHotlinkBlocked(enc)) return Promise.resolve(enc)
          return fetchOgImage(item.link!)
        })
      )

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // 근접 중복(유사 제목) 사전 차단 — 토큰 3개 이상일 때만 판정(짧은 제목 오탐 방지)
        const tokens = titleTokens(item.title!.trim())
        if (tokens.size >= 3 && seenTitles.some(s => jaccard(tokens, s) >= SIM_THRESHOLD)) {
          skippedDup++
          continue
        }

        // URL 완전일치 중복은 unique constraint가 차단
        const { error } = await supabase
          .from("articles")
          .insert({
            title: item.title!.trim(),
            url: item.link,
            source: source.slug,
            source_name: source.name,
            source_type: CAMPAIGN_SLUGS.includes(source.slug) ? "campaign" : "insight",
            author: item.creator ?? item.author ?? null,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            raw_content: stripBom(item.contentSnippet ?? item.content ?? null),
            image_url: images[i],
            status: "pending",
          })
          .select()

        if (!error) { totalNew++; seenTitles.push(tokens) } // 신규분도 누적 → 같은 실행 내 중복 차단
      }

      // last_fetched_at 업데이트
      await supabase
        .from("rss_sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", source.id)

    } catch (err) {
      errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    success: true,
    collected: totalNew,
    skippedDuplicates: skippedDup,
    sources: sources.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
