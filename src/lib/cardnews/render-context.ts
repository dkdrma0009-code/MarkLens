import { fetchImageWithDims } from "./image"
import { sourceMetric, visualFamily, type EditorialContext } from "./editorial"
import type { Slide } from "./types"

export interface EditorialArticle {
  image_url?: string | null
  fallback_image?: { url?: string } | null
  raw_content?: string | null
  source_name?: string | null
  published_at?: string | null
}

export async function prepareEditorialContext(slides: Slide[], category: string, article: EditorialArticle | null): Promise<EditorialContext | undefined> {
  if (!slides.some(s => s.role)) return undefined
  const source = article?.source_name ?? ""
  const date = article?.published_at?.slice(0, 10) ?? ""
  const metric = sourceMetric(slides, article?.raw_content ?? "", source, date)
  const cover = slides.find(s => s.type === "cover")
  const preliminary = visualFamily(category, slides, true, metric)
  // Typography/data posts do not fetch decorative stock photographs.
  const image = preliminary === "photo" && (cover?.type !== "cover" || cover.usePhoto !== false)
    ? (await fetchImageWithDims(article?.image_url)) ?? (await fetchImageWithDims(article?.fallback_image?.url))
    : null
  return { family: visualFamily(category, slides, !!image, metric), image, metric, source, date, photoCrop: cover?.type === "cover" && cover.photoCrop === true }
}
