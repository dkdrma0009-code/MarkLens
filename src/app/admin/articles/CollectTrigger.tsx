"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

export default function CollectTrigger() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCollect() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/collect", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.collected}개 새 아티클 수집됐습니다.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "수집 실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCollect}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "수집 중..." : "RSS 수집"}
    </button>
  )
}
