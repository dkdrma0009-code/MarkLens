"use client"

import { useState } from "react"
import AnalysisFlow from "./AnalysisFlow"
import { FileText } from "lucide-react"

const MAX_CHARS = 1500

export default function FreeAnalysisTab() {
  const [articleText, setArticleText] = useState("")
  const [articleTitle, setArticleTitle] = useState("")
  const [started, setStarted] = useState(false)
  const [key, setKey] = useState(0)

  if (started) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => { setStarted(false); setKey(k => k + 1) }}
          className="self-start text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          ← 다른 기사 입력하기
        </button>
        <AnalysisFlow
          key={key}
          article={{ title: articleTitle || "자유 분석", summary: articleText }}
          customArticleText={articleText}
          onComplete={() => {}}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">자유 분석</p>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">내가 고른 기사 분석하기</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          관심 있는 마케팅 트렌드나 기사를 붙여넣고, AI 평가를 받아보세요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={articleTitle}
          onChange={e => setArticleTitle(e.target.value)}
          placeholder="기사 제목 (선택)"
          maxLength={100}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="relative">
          <textarea
            value={articleText}
            onChange={e => setArticleText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={`분석할 트렌드 / 기사 내용을 여기에 붙여넣으세요.\n\n예) 무신사 스탠다드의 2024년 4분기 오프라인 매출이 전년 동기 대비 68% 증가했다. 특히 30-40대 남성 고객 비율이 처음으로 20대를 넘어섰으며...`}
            rows={10}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="absolute bottom-3 right-4 text-xs text-gray-300 dark:text-gray-600">
            {articleText.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        onClick={() => setStarted(true)}
        disabled={articleText.trim().length < 50}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        분석 시작하기
      </button>
      {articleText.trim().length > 0 && articleText.trim().length < 50 && (
        <p className="text-xs text-gray-400 text-center">최소 50자 이상 입력해주세요 ({50 - articleText.trim().length}자 더 필요)</p>
      )}
    </div>
  )
}
