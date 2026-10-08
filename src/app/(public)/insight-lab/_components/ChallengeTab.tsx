"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import AnalysisFlow from "./AnalysisFlow"
import type { InsightChallenge } from "@/types/insight-lab"

const DIFFICULTY_COLOR: Record<string, string> = {
  쉬움: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  보통: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950",
  어려움: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
}

export default function ChallengeTab() {
  const [challenge, setChallenge] = useState<InsightChallenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    fetch("/api/insight-lab/challenge")
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setChallenge(data)
      })
      .catch(() => setError("챌린지를 불러오지 못했어요"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-500">{error || "오늘의 챌린지가 없어요"}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {done && (
        <div className="ml-career-completion">
          <p className="text-sm font-bold">오늘의 챌린지를 완료했어요. 피드백을 읽고 다음 답변에 적용해보세요.</p>
          <button onClick={() => { setDone(false); setAttempt(value => value + 1) }} className="text-sm underline mt-3">다시 도전하기</button>
        </div>
      )}
      {/* 챌린지 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">오늘의 챌린지</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[challenge.difficulty]}`}>
              {challenge.difficulty}
            </span>
            <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {challenge.category}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{challenge.title}</h2>
          {challenge.source_name && (
            <p className="text-xs text-gray-400 mt-1">출처: {challenge.source_name}</p>
          )}
        </div>
      </div>

      <AnalysisFlow
        key={attempt}
        article={{ title: challenge.title, summary: challenge.summary }}
        challengeId={challenge.id}
        onComplete={() => setDone(true)}
      />
    </div>
  )
}
