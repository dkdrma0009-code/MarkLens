import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import ArticleStory, { articleStoryToc, type ArticleStoryData } from "@/components/insights/ArticleStory"
import ArticleActions from "@/app/admin/articles/ArticleActions"
import { ContentError, ContentStatus } from "@/components/admin-v2/ContentQueue"
import "@/app/(public)/public.css"
import "@/app/(public)/insights/insights.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "검수 Preview | MarkLens Admin", robots: { index: false, follow: false } }

export default async function AdminPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin()
  const { slug } = await params
  const { data, error } = await createAdminClient().from("insights").select("*, article:articles(*)").eq("slug", slug).maybeSingle()
  if (error) return <div className="admin-content-queue"><ContentError /></div>
  if (!data) notFound()
  const insight = data as unknown as ArticleStoryData
  const article = insight.article
  const title = insight.hook || article?.title || "제목 기록 없음"
  const terms = Array.isArray(insight.marketing_terms) ? insight.marketing_terms.filter(t => t?.term && t?.definition) : []
  return <div className="admin-review-preview">
    <div className="admin-preview-bar"><div><strong>PREVIEW — {article?.status === "published" ? "PUBLISHED CONTENT" : "NOT PUBLIC"}</strong><Link href="/admin/articles">← Back to Articles</Link></div>
      <ContentStatus status={article?.status || "unknown"} />
      {article?.id && <ArticleActions articleId={article.id} status={article.status || "unknown"} hasInsight={!!(insight.hook?.trim() && insight.summary?.trim())} title={title} />}
    </div>
    <div className="marklens-public"><article className="ml-article"><div className="ml-container">
      <ArticleStory insight={insight} title={title} terms={terms} toc={articleStoryToc(insight,terms)} color="#164bff" preview />
    </div></article></div>
  </div>
}
