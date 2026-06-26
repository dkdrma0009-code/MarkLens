import { createAdminClient } from "@/lib/supabase/admin"
import type { MetadataRoute } from "next"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const supabase = createAdminClient()

  const { data: insights } = await supabase
    .from("insights")
    .select("slug, updated_at, article:articles!inner(status)")
    .eq("articles.status", "published")
    .order("updated_at", { ascending: false })

  const insightUrls: MetadataRoute.Sitemap = (insights ?? []).map((i) => ({
    url: `${base}/insights/${i.slug}`,
    lastModified: new Date(i.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/insights`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/practice`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    // 타깃 검색 의도(마케팅 면접 연습·퀴즈·인사이트 분석 훈련)에 걸리는 도구 페이지 — 색인 대상
    { url: `${base}/insight-lab`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/interview`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/learn`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/glossary`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/newsletter`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...insightUrls,
  ]
}
