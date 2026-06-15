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
    { url: `${base}/library`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/competitions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/newsletter`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    ...insightUrls,
  ]
}
