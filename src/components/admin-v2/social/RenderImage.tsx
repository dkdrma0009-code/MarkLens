"use client"
import { useState } from "react"
import Image from "next/image"

export default function RenderImage({ src, alt, retry = true }: { src: string; alt: string; retry?: boolean }) {
  const [failed, setFailed] = useState(false)
  return failed ? <div className="social-asset-missing" role="status">Preview asset를 불러오지 못했습니다.<br />저장된 콘텐츠와 render 상태를 확인하세요.{retry && <button className="admin-control" onClick={() => setFailed(false)}>다시 시도</button>}</div>
    : <Image src={src} alt={alt} width={1080} height={1350} unoptimized onError={() => setFailed(true)} className="social-render-image" />
}
