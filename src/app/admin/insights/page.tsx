import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import ContentQueue, { ContentError, type ContentRow } from "@/components/admin-v2/ContentQueue"

export const dynamic = "force-dynamic"
interface InsightRow {
  id: string; article_id: string; slug: string; hook: string | null; summary: string | null; tags: string[] | null; category: string | null; created_at: string;
  article: { title: string; source_name: string | null; status: string; image_url: string | null; fallback_image: { url?: string } | null; site_published_at: string | null } | null
}
export default async function AdminInsightsPage() {
  await requireAdmin()
  let rows: ContentRow[] | null = null
  try {
    const { data, error } = await createAdminClient().from("insights")
      .select("id,article_id,slug,hook,summary,tags,category,created_at,article:articles(title,source_name,status,image_url,fallback_image,site_published_at)")
      .order("created_at", { ascending: false }).limit(200)
    if (error) throw new Error("Insight query failed")
    rows = ((data ?? []) as unknown as InsightRow[]).map(insight => ({ id: insight.id, articleId: insight.article_id,
      title: insight.article?.title || "제목 기록 없음", hook: insight.hook, summary: insight.summary, tags: insight.tags, source: insight.article?.source_name,
      status: insight.article?.status || "unknown", category: insight.category, createdAt: insight.created_at,
      sitePublished: insight.article?.site_published_at, image: !!(insight.article?.image_url?.trim() || insight.article?.fallback_image?.url?.trim()),
      hasInsight: !!(insight.hook?.trim() && insight.summary?.trim()), insightId: insight.id, slug: insight.slug }))
  } catch { rows = null }
  if (rows === null) return <div className="admin-content-queue"><ContentError /></div>
  return <ContentQueue kind="insights" rows={rows} />
}
