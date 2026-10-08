"use client"

import Image from "next/image"
import { useState } from "react"
import { isHotlinkBlocked, weservThumb } from "@/lib/images"

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
  return <figure className="ml-article-visual">
    <div className="ml-article-image">{src ? <Image key={src} src={weservThumb(src, 1600)} alt="" fill sizes="(max-width: 767px) 100vw, 1320px" loading="eager" fetchPriority="high" onError={() => usingOriginal ? setOriginalFailed(true) : setFallbackFailed(true)} /> : <div className="ml-image-fallback" aria-label="기사 이미지 없음"><span aria-hidden="true">M<span>↗</span></span><small>MARKETING × TREND × INTELLIGENCE</small></div>}</div>
    {!usingOriginal && src && fallback?.credit ? <figcaption>대체 이미지 · Photo by <a href={`${fallback.creditLink ?? "https://unsplash.com"}?utm_source=marklens&utm_medium=referral`} target="_blank" rel="noopener noreferrer">{fallback.credit}</a> on <a href="https://unsplash.com/?utm_source=marklens&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></figcaption> : null}
  </figure>
}
