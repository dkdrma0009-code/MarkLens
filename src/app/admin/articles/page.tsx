import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import ContentQueue, { ContentError, type ContentRow } from "@/components/admin-v2/ContentQueue"

export const dynamic = 'force-dynamic'
const CASE_SOURCES = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireAdmin()
  const { type } = await searchParams
  const isCase = type === "case"
  let rows: ContentRow[] | null = null
  try {
    const db = createAdminClient()
    let query = db.from("articles").select("id,title,url,source_name,status,created_at,published_at,site_published_at,image_url,fallback_image,raw_content,insights(id,slug,hook,summary,category)")
      .in("status", ["pending", "analyzing", "ready", "published", "rejected"]).order("created_at", { ascending: false }).limit(100)
    query = isCase ? query.in("source", CASE_SOURCES) : query.not("source", "in", `(${CASE_SOURCES.map(s => `"${s}"`).join(",")})`)
    const { data, error } = await query
    if (error) throw new Error("Article query failed")
    rows = (data ?? []).map(article => {
      const insight = article.insights?.[0]
      const fallback = article.fallback_image as { url?: string } | null
      return { id: article.id, articleId: article.id, title: article.title, source: article.source_name, status: article.status,
        createdAt: article.created_at, sourcePublished: article.published_at, sitePublished: article.site_published_at,
        image: !!(article.image_url?.trim() || fallback?.url?.trim()), imageUrl: article.image_url, rawContent: article.raw_content,
        insightId: insight?.id, slug: insight?.slug, hasInsight: !!(insight?.hook?.trim() && insight?.summary?.trim()), category: insight?.category, url: article.url }
    })
  } catch { rows = null }
  if (rows === null) return <div className="admin-content-queue"><ContentError /></div>
  return <ContentQueue kind="articles" rows={rows} isCase={isCase} />
}
