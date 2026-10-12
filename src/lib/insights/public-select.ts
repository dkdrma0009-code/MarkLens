import type { HomeInsight } from "@/components/home/data"
import type { ArticleStoryData } from "@/components/insights/ArticleStory"

// Cards/search never carry source text, audience metrics or operational state.
export const PUBLIC_INSIGHT_CARD_SELECT = "id,slug,hook,summary,category,is_featured,created_at,tags,keywords,article:articles!inner(title,source_name,image_url,fallback_image,site_published_at)"
export const PUBLIC_HOME_SELECT = "id,slug,hook,summary,category,is_featured,created_at,practical_applications,framework_analysis,portfolio_usage,article:articles!inner(title,source_name,image_url,fallback_image,site_published_at)"
export const PUBLIC_INSIGHT_DETAIL_SELECT = "id,slug,hook,summary,category,created_at,updated_at,tags,keywords,key_takeaways,why_it_matters,framework_analysis,practical_applications,portfolio_usage,interview_points,marketing_terms,quiz,video_url,article:articles(title,source_name,author,url,image_url,fallback_image)"

export type PublicInsightCard = Pick<HomeInsight, "id" | "slug" | "hook" | "summary" | "category" | "is_featured" | "created_at" | "article"> & { tags?: string[] | null; keywords?: string[] | null }
export type PublicInsightDetail = ArticleStoryData & { updated_at?: string | null; tags?: string[] | null; keywords?: string[] | null }

export function publicCard(insight: PublicInsightCard): PublicInsightCard {
  const article = insight.article
  return {
    id: insight.id, slug: insight.slug, hook: insight.hook, summary: insight.summary,
    category: insight.category, is_featured: insight.is_featured, created_at: insight.created_at,
    tags: insight.tags, keywords: insight.keywords,
    article: article ? {
      title: article.title, source_name: article.source_name, image_url: article.image_url,
      site_published_at: article.site_published_at,
      fallback_image: article.fallback_image ? { url: article.fallback_image.url } : null,
    } : null,
  }
}
