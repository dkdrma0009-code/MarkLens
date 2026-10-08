"use client"

import Image from "next/image"
import { useState } from "react"
import { isHotlinkBlocked, weservThumb } from "@/lib/images"
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
        src={weservThumb(source, eager ? 1600 : 1440)}
        alt=""
        fill
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        onError={() => usingOriginal ? setOriginalFailed(true) : setFallbackFailed(true)}
      /> : <div className="ml-image-fallback" aria-label="기사 이미지 없음"><span aria-hidden="true">M<span>↗</span></span><small>MARKETING × TREND × INTELLIGENCE</small></div>}
    </div>
  )
}
