"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function ToggleSource({ id, isActive }: { id: string; isActive: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(isActive ? "비활성화됐습니다." : "활성화됐습니다.")
      router.refresh()
    } catch {
      toast.error("오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
      }`}
    >
      {isActive ? "활성" : "비활성"}
    </button>
  )
}

export function AddSourceForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", rss_url: "", website_url: "" })
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "추가 실패")
      }
      toast.success("소스가 추가됐습니다.")
      setOpen(false)
      setForm({ name: "", slug: "", rss_url: "", website_url: "" })
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가 실패")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium px-4 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
      >
        + 소스 추가
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">RSS 소스 추가</h2>
        {[
          { field: "name", label: "소스명", placeholder: "예: HubSpot Blog" },
          { field: "slug", label: "슬러그", placeholder: "예: hubspot-blog" },
          { field: "rss_url", label: "RSS URL", placeholder: "https://..." },
          { field: "website_url", label: "웹사이트 URL", placeholder: "https://..." },
        ].map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
            <input
              required
              value={form[field as keyof typeof form]}
              onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
              placeholder={placeholder}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? "추가 중..." : "추가"}
          </button>
        </div>
      </form>
    </div>
  )
}
