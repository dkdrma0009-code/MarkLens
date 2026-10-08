"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function PublicError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="ml-pages"><div className="ml-state ml-container">
      <p className="ml-eyebrow">TEMPORARILY OUT OF FOCUS</p>
      <h1>잠시 연결이 흐려졌습니다.</h1>
      <p>페이지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      <div className="ml-state-actions"><button onClick={unstable_retry} className="ml-button ml-button-blue">다시 시도 →</button><Link href="/" className="ml-text-link">홈으로 →</Link></div>
    </div></div>
  )
}
