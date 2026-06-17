import { createAdminClient } from "@/lib/supabase/admin"
import { getInstagramInsights } from "@/lib/instagram"
import CardnewsTable, { type CardnewsRow } from "./CardnewsTable"

export const dynamic = "force-dynamic"

interface CardRecord {
  article_id: string
  updated_at: string
  posted_at?: string | null
  reels_posted_at?: string | null
  scheduled_at?: string | null
  ig_post_id?: string | null
  first_slide?: { usePhoto?: boolean } | null
}

export default async function CardnewsListPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const { term: initialTerm } = await searchParams
  const supabase = createAdminClient()

  const insightsQuery = supabase
    .from("insights")
    .select("article_id, hook, category, created_at, article:articles!inner(title, status, image_url)")
    .eq("article.status", "published")
    .order("created_at", { ascending: false })
    .limit(100)

  // posted_at 컬럼이 아직 없으면(42703) 컬럼 빼고 재시도 — UI는 동작 유지
  let cards: CardRecord[] = []
  let postedColumnMissing = false
  {
    const { data, error } = await supabase
      .from("cardnews")
      .select("article_id, updated_at, posted_at, reels_posted_at, scheduled_at, ig_post_id, first_slide:slides->0")
    if (error) {
      postedColumnMissing = true
      const { data: fallback } = await supabase
        .from("cardnews")
        .select("article_id, updated_at, first_slide:slides->0")
      cards = (fallback ?? []) as CardRecord[]
    } else {
      cards = (data ?? []) as CardRecord[]
    }
  }

  const [{ data: insights }, { data: cfg }, igInsights] = await Promise.all([
    insightsQuery,
    supabase.from("app_config").select("value").eq("key", "ig_auto_publish").maybeSingle(),
    getInstagramInsights(),
  ])

  // 인스타 자동발행 스위치 (app_config — 테이블 없으면 off)
  const autoPublish = cfg?.value === "on"

  // ig_post_id → 성과 지표 맵
  const igStatsMap: Record<string, { likes: number; reach: number; saved: number }> = {}
  for (const m of igInsights?.media ?? []) {
    igStatsMap[m.id] = { likes: m.likes, reach: m.reach, saved: m.saved }
  }

  type Row = {
    article_id: string
    hook?: string | null
    category?: string | null
    created_at: string
    article?: { title?: string | null; image_url?: string | null } | null
  }

  const cardMap = new Map(cards.map(c => [c.article_id, c]))
  const rows: CardnewsRow[] = ((insights ?? []) as Row[]).map(r => {
    const card = cardMap.get(r.article_id)
    const igPostId = card?.ig_post_id ?? null
    return {
      articleId: r.article_id,
      hook: r.hook ?? null,
      title: r.article?.title ?? null,
      category: r.category ?? null,
      createdAt: r.created_at,
      cardAt: card?.updated_at ?? null,
      postedAt: card?.posted_at ?? null,
      reelsPostedAt: card?.reels_posted_at ?? null,
      scheduledAt: card?.scheduled_at ?? null,
      usePhoto: card?.first_slide?.usePhoto !== false && !!r.article?.image_url,
      igPostId,
      igStats: igPostId ? (igStatsMap[igPostId] ?? null) : null,
    }
  })

  const doneCount = rows.filter(r => r.cardAt).length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">카드뉴스 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          발행된 인사이트 <span className="font-medium text-foreground">{rows.length}개</span>
          {" · "}카드뉴스 생성됨 <span className="font-medium text-foreground">{doneCount}개</span>
        </p>
        {postedColumnMissing && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠ 업로드 완료 기능을 쓰려면 Supabase SQL Editor에서 실행:{" "}
            <code className="bg-amber-50 px-1 rounded">alter table cardnews add column if not exists posted_at timestamptz;</code>
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          발행된 인사이트가 없습니다.
        </div>
      ) : (
        <CardnewsTable initialRows={rows} autoPublish={autoPublish} initialTerm={initialTerm} />
      )}
    </div>
  )
}
