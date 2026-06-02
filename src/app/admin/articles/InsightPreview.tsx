"use client"

import { useState } from "react"
import { X, ExternalLink } from "lucide-react"

interface Props {
  articleId: string
  articleTitle: string
  articleUrl: string
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

export default function InsightPreview({ articleId, articleTitle, articleUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (insight) { setOpen(true); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/insight-preview?articleId=${articleId}`)
      const data = await res.json()
      setInsight(data.insight)
      setOpen(true)
    } catch {
      alert("미리보기를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={load}
        disabled={loading}
        className="text-xs text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "로딩..." : "미리보기"}
      </button>

      {open && insight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {insight.category && (
                  <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full text-white bg-gray-700 mb-2">
                    {insight.category}
                  </span>
                )}
                <h2 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">
                  {insight.hook ?? articleTitle}
                </h2>
                <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-1">
                  원문 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* 요약 */}
              {insight.summary && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">핵심 요약</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{insight.summary}</p>
                </div>
              )}

              {/* 핵심 포인트 */}
              {insight.key_takeaways && insight.key_takeaways.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">이것만 기억하세요</p>
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

              {/* 왜 중요한가 */}
              {insight.why_it_matters && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">왜 중요한가</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.why_it_matters}</p>
                </div>
              )}

              {/* 실전 적용법 */}
              {insight.practical_applications && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">실전 적용법</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.practical_applications}</p>
                </div>
              )}

              {/* 프레임워크 */}
              {insight.framework_analysis && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">프레임워크 분석</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.framework_analysis}</p>
                </div>
              )}

              {/* 포트폴리오 */}
              {insight.portfolio_usage && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">포트폴리오 활용</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{insight.portfolio_usage}</p>
                </div>
              )}

              {/* 실생활 활용 */}
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
