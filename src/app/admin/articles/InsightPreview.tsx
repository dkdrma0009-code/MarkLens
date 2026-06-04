"use client"

import { useState } from "react"
import { X, ExternalLink, FileText, Eye } from "lucide-react"

interface Props {
  articleId: string
  articleTitle: string
  articleUrl: string
  sourceName?: string
  rawContent?: string | null
  imageUrl?: string | null
  hasInsight: boolean
}


export default function InsightPreview({
  articleId,
  articleTitle,
  articleUrl,
  sourceName,
  rawContent,
  imageUrl,
  hasInsight,
}: Props) {
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function loadSlug() {
    if (slug) return slug
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/insight-preview?articleId=${articleId}`)
      const data = await res.json()
      const s = data.insight?.slug ?? null
      setSlug(s)
      return s
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    setExpanded(false)
  }

  async function handlePreviewPage() {
    const s = await loadSlug()
    if (s) window.open(`/admin/preview/${s}`, "_blank")
  }

  const preview = rawContent
    ? expanded ? rawContent : rawContent.slice(0, 400) + (rawContent.length > 400 ? "..." : "")
    : null

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="미리보기"
      >
        <FileText className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-1">{sourceName}</p>
                <h2 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
                  {articleTitle}
                </h2>
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1"
                >
                  원문 보기 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 flex-shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0">
              {hasInsight && (
                <button
                  onClick={handlePreviewPage}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {loading ? "불러오는 중..." : "발행 미리보기"}
                </button>
              )}
              {!hasInsight && (
                <span className="text-xs text-gray-400 px-2">분석 후 미리보기 가능합니다</span>
              )}
            </div>

            {/* Content — 원본 아티클 */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="space-y-4">
                {imageUrl && (
                  <img src={imageUrl} alt="" className="w-full h-48 object-cover rounded-xl" />
                )}
                {preview ? (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">수집된 본문</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{preview}</p>
                    {rawContent && rawContent.length > 400 && (
                      <button
                        onClick={() => setExpanded(v => !v)}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                      >
                        {expanded ? "접기" : `전체 보기 (${rawContent.length.toLocaleString()}자)`}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">수집된 본문이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
