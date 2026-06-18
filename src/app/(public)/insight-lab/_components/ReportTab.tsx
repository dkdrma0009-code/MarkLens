"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, Flame, Star, BarChart2 } from "lucide-react"
import InsightRadarChart from "./InsightRadarChart"
import XPBar from "./XPBar"
import type { InsightUserStats, InsightScores } from "@/types/insight-lab"

interface SessionItem {
  id: string
  xp_earned: number
  score_observation: number
  score_analysis: number
  score_insight: number
  score_strategy: number
  created_at: string
}

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function ReportTab() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<InsightUserStats | null>(null)
  const [sessions, setSessions] = useState<SessionItem[]>([])

  useEffect(() => {
    fetch("/api/insight-lab/stats")
      .then(r => r.json())
      .then(data => {
        setStats(data.stats)
        setSessions(data.sessions ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!stats || stats.total_sessions === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="text-5xl">📊</div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">아직 분석 기록이 없어요</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">오늘의 챌린지를 완료하면 성장 리포트가 생성됩니다.</p>
      </div>
    )
  }

  const avgScores: InsightScores = {
    cliche: 3, // 평균 통계에서 cliche/pivot은 별도 집계 전까지 중간값 사용
    pivot: 3,
    observation: Number(stats.avg_score_observation),
    analysis: Number(stats.avg_score_analysis),
    insight: Number(stats.avg_score_insight),
    strategy: Number(stats.avg_score_strategy),
  }
  const totalAvg = Math.round((avgScores.observation + avgScores.analysis + avgScores.insight + avgScores.strategy) / 4)

  return (
    <div className="flex flex-col gap-6">
      {/* XP 바 */}
      <XPBar xp={stats.total_xp} streak={stats.streak_days} totalSessions={stats.total_sessions} />

      {/* 스탯 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="누적 분석" value={`${stats.total_sessions}회`} icon={<BarChart2 className="w-5 h-5" />} />
        <StatCard label="연속 활동" value={`${stats.streak_days}일`} icon={<Flame className="w-5 h-5" />} />
        <StatCard label="평균 점수" value={`${totalAvg}점`} icon={<Star className="w-5 h-5" />} sub="4개 차원 평균" />
        <StatCard label="누적 XP" value={`${stats.total_xp.toLocaleString()} XP`} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* 레이더 차트 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">나의 능력치 프로파일</p>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
          <InsightRadarChart scores={avgScores} size={280} />
        </div>
      </div>

      {/* 약점 분석 */}
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
        {(() => {
          type AuxKey = "observation" | "analysis" | "insight" | "strategy"
          const auxKeys: AuxKey[] = ["observation", "analysis", "insight", "strategy"]
          const entries = auxKeys.map(k => [k, avgScores[k]] as [AuxKey, number])
          const weakest = entries.sort((a, b) => a[1] - b[1])[0]
          const labels: Record<AuxKey, string> = {
            observation: "관찰력", analysis: "분석력", insight: "인사이트력", strategy: "전략력"
          }
          const tips: Record<AuxKey, string> = {
            observation: "기사에서 숫자와 퍼센트를 먼저 찾고, 누가·언제·얼마나를 구체화해보세요.",
            analysis: "\"왜?\"를 3번 연속으로 물어보는 '5 Whys' 기법을 연습해보세요.",
            insight: "\"~는 ~가 아니라 ~이다\" 형식으로 역설적 관찰을 문장화해보세요.",
            strategy: "특정 브랜드를 먼저 정한 후, 그 브랜드의 목표 고객과 연결하는 방식으로 접근해보세요.",
          }
          return (
            <>
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2">
                강화 포인트 — {labels[weakest[0]]} ({Math.round(weakest[1])}점)
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tips[weakest[0]]}</p>
            </>
          )
        })()}
      </div>

      {/* 최근 세션 히스토리 */}
      {sessions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">최근 분석 히스토리</p>
          <div className="flex flex-col gap-2">
            {sessions.map(s => {
              const avg = Math.round(((s.score_observation ?? 0) + (s.score_analysis ?? 0) + (s.score_insight ?? 0) + (s.score_strategy ?? 0)) / 4)
              const date = new Date(s.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{date}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{avg}점</span>
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">+{s.xp_earned} XP</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
