"use client"

import { useState } from "react"
import { isHotlinkBlocked, weservThumb } from "@/lib/images"

interface Props {
  src: string
  alt: string
  gradient: string
  className?: string
  fallbackSrc?: string  // 원본이 없거나 차단일 때 쓸 Unsplash 폴백
}

export default function InsightThumbnail({ src, alt, gradient, className = "", fallbackSrc = "" }: Props) {
  const [imgFailed, setImgFailed] = useState(false) // 원본 로드 실패
  const [fbFailed, setFbFailed] = useState(false)   // 폴백 로드 실패

  // 우선순위: 유효한 원본(비차단) → Unsplash 폴백 → 그라디언트
  const originalOk = !!src && !isHotlinkBlocked(src) && !imgFailed
  const usingOriginal = originalOk
  const effective = originalOk ? src : (fallbackSrc && !fbFailed ? fallbackSrc : "")

  if (!effective) {
    return <div className={`bg-gradient-to-br ${gradient} ${className}`} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={weservThumb(effective, 440)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => (usingOriginal ? setImgFailed(true) : setFbFailed(true))}
      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${className}`}
    />
  )
}
