"use client"

import { useEffect } from "react"

export default function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    // 세션당 한 번만 카운팅
    const key = `viewed:${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    fetch(`/api/insights/${slug}/view`, { method: "POST" })
  }, [slug])
  return null
}
