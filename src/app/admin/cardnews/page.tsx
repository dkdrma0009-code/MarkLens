import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getInstagramInsights } from "@/lib/instagram"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import SocialQueue from "@/components/admin-v2/social/SocialQueue"
import type { CardnewsRow, CurationRow } from "@/components/admin-v2/social/types"
import type { Slide } from "@/lib/cardnews/types"

export const dynamic = "force-dynamic"
interface CardRecord {
  article_id: string; updated_at: string; posted_at?: string | null; reels_posted_at?: string | null
  scheduled_at?: string | null; ig_post_id?: string | null; slides?: Slide[]; caption?: string | null
}
export default async function CardnewsListPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  await requireAdmin()
  const { term } = await searchParams
  const db = createAdminClient()
  const [insightsResult, cardsResult, cfgResult, curationsResult, igInsights] = await Promise.all([
    db.from("insights").select("article_id,hook,category,created_at,article:articles!inner(title,status,image_url)").eq("article.status", "published").order("created_at", { ascending: false }).limit(100),
    db.from("cardnews").select("article_id,updated_at,posted_at,reels_posted_at,scheduled_at,ig_post_id,slides,caption"),
    db.from("app_config").select("value").eq("key", "ig_auto_publish").maybeSingle(),
    db.from("curations").select("id,week_of,slides,caption,posted_at,ig_post_id").order("week_of", { ascending: false }).limit(20),
    getInstagramInsights(),
  ])
  let cards = (cardsResult.data || []) as CardRecord[]
  let statusUnavailable = false
  if (cardsResult.error?.code === "42703") {
    const fallback = await db.from("cardnews").select("article_id,updated_at,slides,caption")
    if (fallback.error) return <div className="social-workspace"><ContentError /></div>
    cards = (fallback.data || []) as CardRecord[]
    statusUnavailable = true
  } else if (cardsResult.error || insightsResult.error) return <div className="social-workspace"><ContentError /></div>
  if (insightsResult.error) return <div className="social-workspace"><ContentError /></div>
  const stats = new Map((igInsights?.media || []).map(item => [item.id, { likes: item.likes, reach: item.reach, saved: item.saved }]))
  const cardMap = new Map(cards.map(card => [card.article_id, card]))
  type InsightRow = { article_id: string; hook: string | null; category: string | null; created_at: string; article: { title: string; image_url: string | null } }
  const rows: CardnewsRow[] = ((insightsResult.data || []) as unknown as InsightRow[]).map(insight => {
    const card = cardMap.get(insight.article_id)
    return { articleId: insight.article_id, hook: insight.hook, title: insight.article?.title || null, category: insight.category, createdAt: insight.created_at,
      cardAt: card?.updated_at || null, postedAt: card?.posted_at || null, reelsPostedAt: card?.reels_posted_at || null, scheduledAt: card?.scheduled_at || null,
      usePhoto: card?.slides?.[0]?.type === "cover" && card.slides[0].usePhoto !== false && !!insight.article?.image_url,
      igPostId: card?.ig_post_id || null, igStats: card?.ig_post_id ? stats.get(card.ig_post_id) || null : null, slides: card?.slides || null, caption: card?.caption }
  })
  return <>{cfgResult.error && <p className="social-notice" role="alert">자동발행 설정 조회 실패 · 현재 ON/OFF 상태를 확정하지 않습니다.</p>}
    <SocialQueue initialRows={rows} autoPublish={cfgResult.error ? null : cfgResult.data?.value === "on"} initialTerm={term} curations={(curationsResult.data || []) as unknown as CurationRow[]} curationError={!!curationsResult.error} statusUnavailable={statusUnavailable} />
  </>
}
