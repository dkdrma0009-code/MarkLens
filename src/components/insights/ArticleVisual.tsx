"use client"

import { useEffect, useRef, useState } from "react"
import CdnImage from "@/components/media/CdnImage"
import { isHotlinkBlocked } from "@/lib/images"

interface ArticleImage {
  image_url?: string | null
  fallback_image?: { url?: string; credit?: string; creditLink?: string } | null
}

export default function ArticleVisual({ article }: { article?: ArticleImage | null }) {
  const [originalFailed, setOriginalFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const usingOriginal = !!article?.image_url && !isHotlinkBlocked(article.image_url) && !originalFailed
  const fallback = article?.fallback_image
  const src = usingOriginal ? article?.image_url : !fallbackFailed && fallback?.url && !isHotlinkBlocked(fallback.url) ? fallback.url : null
  const frame = useRef<HTMLDivElement>(null)
  // The image is server-rendered and preloaded, so it can fail before React attaches onError; replay that error once mounted.
  useEffect(() => {
    const img = frame.current?.querySelector("img")
    if (img?.complete && img.naturalWidth === 0) img.dispatchEvent(new Event("error"))
  }, [src])
  // No usable image (none stored, blocked, or both the original and the fallback failed to load): no placeholder art,
  // the lead runs straight into the article.
  if (!src) return null
  return <figure className="ml-article-visual">
    <div ref={frame} className="ml-article-image"><CdnImage key={src} src={src} fallbackWidth={1600} alt="" sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) calc(100vw - 64px), (max-width: 1415px) calc(100vw - 96px), 1320px" loading="eager" fetchPriority="high" onError={() => usingOriginal ? setOriginalFailed(true) : setFallbackFailed(true)} /></div>
    {!usingOriginal && fallback?.credit ? <figcaption>대체 이미지 · Photo by <a href={`${fallback.creditLink ?? "https://unsplash.com"}?utm_source=marklens&utm_medium=referral`} target="_blank" rel="noopener noreferrer">{fallback.credit}</a> on <a href="https://unsplash.com/?utm_source=marklens&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></figcaption> : null}
  </figure>
}
