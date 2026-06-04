"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, X } from "lucide-react"

interface Props {
  articleId?: string
  insightId?: string
}

interface Insight {
  id: string
  hook?: string
  summary?: string
  key_takeaways?: string[]
  why_it_matters?: string
  practical_applications?: string
  category?: string
  video_url?: string
}

export default function EditInsight({ articleId, insightId: insightIdProp }: Props) {
  const [open, setOpen] = useState(false)
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function load() {
    if (insight) { setOpen(true); return }
    setLoading(true)
    try {
      const param = insightIdProp
        ? `insightId=${insightIdProp}`
        : `articleId=${articleId}`
      const res = await fetch(`/api/admin/insight-preview?${param}`)
      const data = await res.json()
      if (!data.insight?.id) throw new Error("인사이트 없음")
      setInsight(data.insight)
      setOpen(true)
    } catch {
      toast.error("불러오기 실패")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!insight) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: insight.hook,
          summary: insight.summary,
          key_takeaways: insight.key_takeaways,
          why_it_matters: insight.why_it_matters,
          practical_applications: insight.practical_applications,
          category: insight.category,
          video_url: insight.video_url || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("수정됐습니다.")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("저장 실패")
    } finally {
      setSaving(false)
    }
  }

  function updateField(key: keyof Insight, value: string | string[]) {
    setInsight(prev => prev ? { ...prev, [key]: value } : null)
  }

  return (
    <>
      <button
        onClick={load}
        disabled={loading}
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        title="수정"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && insight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold">인사이트 수정</h2>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <Field label="훅 (제목)">
                <input
                  value={insight.hook ?? ""}
                  onChange={e => updateField("hook", e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
              </Field>

              <Field label="카테고리">
                <input
                  value={insight.category ?? ""}
                  onChange={e => updateField("category", e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
              </Field>

              <Field label="핵심 요약">
                <textarea
                  value={insight.summary ?? ""}
                  onChange={e => updateField("summary", e.target.value)}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                />
              </Field>

              <Field label="핵심 포인트 (줄바꿈으로 구분)">
                <textarea
                  value={(insight.key_takeaways ?? []).join("\n")}
                  onChange={e => updateField("key_takeaways", e.target.value.split("\n").filter(Boolean))}
                  rows={4}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                />
              </Field>

              <Field label="왜 중요한가">
                <textarea
                  value={insight.why_it_matters ?? ""}
                  onChange={e => updateField("why_it_matters", e.target.value)}
                  rows={4}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                />
              </Field>

              <Field label="실전 적용법">
                <textarea
                  value={insight.practical_applications ?? ""}
                  onChange={e => updateField("practical_applications", e.target.value)}
                  rows={4}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
                />
              </Field>

              <Field label="관련 영상 URL (YouTube / Vimeo)">
                <input
                  value={insight.video_url ?? ""}
                  onChange={e => updateField("video_url", e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
                {insight.video_url && (
                  <p className="text-xs text-green-600 mt-1">✓ 영상 URL 입력됨 — 아티클 상단에 임베드됩니다</p>
                )}
              </Field>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
