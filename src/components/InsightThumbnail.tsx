"use client"

import { useState } from "react"

interface Props {
  src: string
  alt: string
  gradient: string
  className?: string
}

export default function InsightThumbnail({ src, alt, gradient, className = "" }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <div className={`bg-gradient-to-br ${gradient} ${className}`} />
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${className}`}
    />
  )
}
