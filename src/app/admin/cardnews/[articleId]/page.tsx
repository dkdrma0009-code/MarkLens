import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import SocialStudio from "@/components/admin-v2/social/SocialStudio"
import type { Slide } from "@/lib/cardnews/types"

export const dynamic = "force-dynamic"
export default async function CardnewsPage({ params, searchParams }: { params: Promise<{ articleId: string }>; searchParams: Promise<{ format?: string }> }) {
  await requireAdmin()
  const { articleId } = await params
  const { format } = await searchParams
  const db = createAdminClient()
  const [article, insight, card] = await Promise.all([
    db.from("articles").select("title,source_name,image_url,created_at").eq("id", articleId).maybeSingle(),
    db.from("insights").select("hook,category").eq("article_id", articleId).maybeSingle(),
    db.from("cardnews").select("*").eq("article_id", articleId).maybeSingle(),
  ])
  if (article.error || insight.error || card.error) return <div className="social-workspace"><ContentError /></div>
  if (!article.data || !insight.data) notFound()
  const record = card.data
  return <div className="social-workspace">
    <Link className="social-back" href="/admin/cardnews">← Social</Link>
    <div className="social-page-heading"><div><p>SOCIAL STUDIO</p><h2>{insight.data.hook || article.data.title}</h2><span>{insight.data.category} / {article.data.source_name}</span></div></div>
    <SocialStudio initialFormat={format} initialCategory={record?.category || insight.data.category || "마케팅"} row={{ articleId, hook: insight.data.hook, title: article.data.title, category: insight.data.category, createdAt: article.data.created_at,
      cardAt: record?.updated_at || null, postedAt: record?.posted_at || null, reelsPostedAt: record?.reels_posted_at || null, scheduledAt: record?.scheduled_at || null, igPostId: record?.ig_post_id || null,
      usePhoto: !!article.data.image_url, slides: (record?.slides as Slide[]) || null, caption: record?.caption || null }} />
  </div>
}
