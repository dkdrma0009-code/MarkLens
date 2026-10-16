"use client"

import Image from "next/image"
import { useState } from "react"
import { isHotlinkBlocked, editorialImageLoader } from "@/lib/images"
import type { HomeInsight } from "./data"

export default function EditorialImage({ insight, sizes, eager = false }: { insight?: HomeInsight; sizes: string; eager?: boolean }) {
  const [originalFailed, setOriginalFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const original = insight?.article?.image_url
  const fallback = insight?.article?.fallback_image?.url
  const usingOriginal = !!original && !isHotlinkBlocked(original) && !originalFailed
  const source = usingOriginal ? original : !fallbackFailed && fallback && !isHotlinkBlocked(fallback) ? fallback : null

  return (
    <div className="ml-image">
      {source ? <Image
        key={source}
        src={editorialImageLoader({ src: source, width: eager ? 1600 : 1440 })}
        alt=""
        fill
        sizes={sizes}
        unoptimized // weserv가 이미 리사이즈·WebP 처리 → Vercel Image Optimization 재변환 방지
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        onError={() => usingOriginal ? setOriginalFailed(true) : setFallbackFailed(true)}
      /> : <div className="ml-image-fallback" aria-label="기사 이미지 없음"><span aria-hidden="true">M<span>↗</span></span><small>MARKETING × TREND × INTELLIGENCE</small></div>}
    </div>
  )
}
