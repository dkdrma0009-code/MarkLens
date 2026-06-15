"use client"

import { useState } from "react"
import { isHotlinkBlocked, weservThumb } from "@/lib/images"

interface Props {
  src: string
  alt: string
  gradient: string
  className?: string
}

export default function InsightThumbnail({ src, alt, gradient, className = "" }: Props) {
  const [failed, setFailed] = useState(false)

  // 차단 매체는 프록시로 우회하지 않고 폴백 (저작권 존중). 빈 src/로드 실패도 폴백.
  if (failed || !src || isHotlinkBlocked(src)) {
    return <div className={`bg-gradient-to-br ${gradient} ${className}`} />
  }

  // 일반 매체는 weserv 프록시 — 리사이즈·webp로 성능 최적화
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={weservThumb(src, 440)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${className}`}
    />
  )
}
