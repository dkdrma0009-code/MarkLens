import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeCompetition } from "@/lib/competitions/analyze"
import { fetchViaJina, extractListUrls } from "@/lib/competitions/scrape"
import { NextResponse } from "next/server"
import Parser from "rss-parser"

export const maxDuration = 300

const SCRAPE_PER_SOURCE = 4 // 소스당 하루 수집 상한 (Jina 호출이 느려 크론 타임아웃 방지 + 검수 부담 고려)

// 공모전 일일 처리 (collect cron이 호출) — ① 마감 지난 published → expired ② 공식 RSS 자동수집
// 기존 webhooks/collect(아티클 RSS) 패턴 복제. 수집 이원화의 두 번째 축(RSS).
const parser = new Parser({ timeout: 10000, headers: { "User-Agent": "MarkLens/1.0" } })

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // ① 마감 지난 published → expired (deadline 있는 것만; lt는 null 무시)
  const { data: expiredRows } = await supabase
    .from("competitions")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("deadline", today)
    .select("id")
  const expiredCount = expiredRows?.length ?? 0

  // ② 공식 RSS 소스 자동수집 (collect_type='rss' active). 소스 없으면 0건.
  const { data: sources } = await supabase
    .from("competition_sources")
    .select("*")
    .eq("is_active", true)
    .eq("collect_type", "rss")

  let collected = 0
  const errors: string[] = []

  for (const source of sources ?? []) {
    try {
      const feed = await parser.parseURL(source.source_url)
      const items = feed.items.slice(0, 10).filter(i => i.link && i.title)

      for (const item of items) {
        const link = item.link!
        // 중복 체크
        const { data: dup } = await supabase.from("competitions").select("id").eq("source_url", link).maybeSingle()
        if (dup) continue

        const snippet = item.contentSnippet ?? item.content ?? item.title ?? ""
        const analysis = await analyzeCompetition({ title: item.title!, content: snippet, url: link })
        if (!analysis?.title) continue

        await supabase.from("competitions").insert({
          title: analysis.title,
          organizer: analysis.organizer,
          source_url: link,
          source_name: source.name,
          thumbnail_url: item.enclosure?.url ?? null,
          description: analysis.description,
          category: analysis.category,
          deadline: analysis.deadline,
          start_date: analysis.start_date,
          prize: analysis.prize,
          eligibility: analysis.eligibility,
          job_fit: analysis.job_fit ?? [],
          difficulty: analysis.difficulty,
          status: "pending",
        })
        collected++
      }
      await supabase.from("competition_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id)
    } catch (err) {
      errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ③ 목록 스크래핑 자동수집 (collect_type='scrape') — Jina로 목록→개별 URL→분석.
  // 마케팅 무관 건은 거르고, 소스당 상한까지만.
  const { data: scrapeSources } = await supabase
    .from("competition_sources")
    .select("*")
    .eq("is_active", true)
    .eq("collect_type", "scrape")

  let scraped = 0
  let skippedIrrelevant = 0

  for (const source of scrapeSources ?? []) {
    try {
      const list = await fetchViaJina(source.source_url)
      const urls = extractListUrls(list.text, source.source_url).slice(0, SCRAPE_PER_SOURCE)

      for (const link of urls) {
        // 중복 체크
        const { data: dup } = await supabase.from("competitions").select("id").eq("source_url", link).maybeSingle()
        if (dup) continue

        let page
        try { page = await fetchViaJina(link) } catch { continue }
        const analysis = await analyzeCompetition({ title: page.title, content: page.text, url: link })
        if (!analysis?.title) continue
        if (analysis.marketing_relevant === false) { skippedIrrelevant++; continue }

        await supabase.from("competitions").insert({
          title: analysis.title,
          organizer: analysis.organizer,
          source_url: link,
          source_name: source.name,
          thumbnail_url: page.image,
          description: analysis.description,
          category: analysis.category,
          deadline: analysis.deadline,
          start_date: analysis.start_date,
          prize: analysis.prize,
          eligibility: analysis.eligibility,
          job_fit: analysis.job_fit ?? [],
          difficulty: analysis.difficulty,
          status: "pending",
        })
        scraped++
      }
      await supabase.from("competition_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id)
    } catch (err) {
      errors.push(`${source.name}(scrape): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    success: true,
    expired: expiredCount,
    collected,
    scraped,
    skippedIrrelevant,
    rssSources: sources?.length ?? 0,
    scrapeSources: scrapeSources?.length ?? 0,
    errors: errors.length ? errors : undefined,
  })
}
