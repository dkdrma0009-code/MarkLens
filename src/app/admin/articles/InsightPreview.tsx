"use client"

import { useState } from "react"
import { X, ExternalLink, FileText, Lightbulb } from "lucide-react"

interface Props {
  articleId: string
  articleTitle: string
  articleUrl: string
  sourceName?: string
  rawContent?: string | null
  imageUrl?: string | null
  hasInsight: boolean
}

interface Insight {
  hook?: string
  summary?: string
  key_takeaways?: string[]
  why_it_matters?: string
  practical_applications?: string
  framework_analysis?: string
  portfolio_usage?: string
  interview_points?: string[]
  category?: string
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
  const [tab, setTab] = useState<"article" | "insight">("article")
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function loadInsight() {
    if (insight) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/insight-preview?articleId=${articleId}`)
      const data = await res.json()
      setInsight(data.insight ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    setTab("article")
    setExpanded(false)
  }

  async function handleTabInsight() {
    setTab("insight")
    await loadInsight()
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

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => setTab("article")}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === "article"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                원본 아티클
              </button>
              <button
                onClick={handleTabInsight}
                disabled={!hasInsight}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  tab === "insight"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                생성된 인사이트
                {!hasInsight && <span className="text-xs ml-1">(미분석)</span>}
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* ── 원본 아티클 탭 ── */}
              {tab === "article" && (
                <div className="space-y-4">
                  {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full h-48 object-cover rounded-xl"
                    />
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
              )}

              {/* ── 인사이트 탭 ── */}
              {tab === "insight" && (
                <div className="space-y-5">
                  {loading && (
                    <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
                  )}
                  {!loading && !insight && (
                    <p className="text-sm text-gray-400 text-center py-8">인사이트를 불러올 수 없습니다.</p>
                  )}
                  {!loading && insight && (
                    <>
                      {insight.category && (
                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full text-white bg-gray-700">
                          {insight.category}
                        </span>
                      )}

                      {insight.hook && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">훅 (제목)</p>
                          <p className="text-base font-bold text-gray-900 leading-snug">{insight.hook}</p>
                        </div>
                      )}

                      {insight.summary && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">핵심 요약</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{insight.summary}</p>
                        </div>
                      )}

                      {insight.key_takeaways && insight.key_takeaways.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">핵심 포인트</p>
                          <div className="space-y-2">
                            {insight.key_takeaways.map((item, i) => (
                              <div key={i} className="flex gap-3 text-sm text-gray-700">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <p className="leading-relaxed">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {insight.why_it_matters && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">왜 중요한가</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.why_it_matters}</p>
                        </div>
                      )}

                      {insight.practical_applications && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">실전 적용법</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.practical_applications}</p>
                        </div>
                      )}

                      {insight.framework_analysis && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">프레임워크 분석</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.framework_analysis}</p>
                        </div>
                      )}

                      {insight.portfolio_usage && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">포트폴리오 활용</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.portfolio_usage}</p>
                        </div>
                      )}

                      {insight.interview_points && insight.interview_points.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">실생활에서 쓰기</p>
                          <div className="space-y-2">
                            {insight.interview_points.map((item, i) => (
                              <div key={i} className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
