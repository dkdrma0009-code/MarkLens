"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Loader2, Star, BookmarkPlus, RotateCcw, Pencil } from "lucide-react"
import InsightRadarChart from "./InsightRadarChart"
import type { InsightFeedback, InsightScores } from "@/types/insight-lab"

// ─── 단계 정의 (3단계) ─────────────────────────────────────────────────────────
// 관찰·맥락 → 핵심 인사이트 → 브랜드 기회. "꺾기"는 강제 단계가 아니라 심사 피드백으로 다룬다.
type AnswerState = { observation: string; insight: string; opportunity: string }

const EMPTY_ANSWERS: AnswerState = { observation: "", insight: "", opportunity: "" }

interface StepDef {
  fieldKey: keyof AnswerState
  emoji: string
  title: string
  placeholder: string
  hint: string
  minLen: number
}

const STEPS: StepDef[] = [
  {
    fieldKey: "observation", emoji: "👁", title: "관찰 · 맥락", minLen: 20,
    placeholder: "이 트렌드에서 무슨 일이 일어나고 있고, 왜 그럴까요?\n예) MZ세대 중고 명품 구매가 43% 늘었다. 가성비보다 '나만의 희소성'을 사는 행동으로 보인다.",
    hint: "현상 + 그 이유를 한 호흡에. 숫자·행동이 구체적일수록 좋아요.",
  },
  {
    fieldKey: "insight", emoji: "✨", title: "핵심 인사이트", minLen: 20,
    placeholder: "이걸 꿰뚫는 한 문장. \"~는 ~가 아니라 ~이다\" 구조가 날카로워요.\n예) MZ에게 중고는 절약이 아니라 안목의 증명이다.",
    hint: "당신의 해석을 적으세요. 뻔해도 괜찮아요 — 심사위원이 읽고 더 밀어줍니다.",
  },
  {
    fieldKey: "opportunity", emoji: "🚀", title: "브랜드 기회", minLen: 20,
    placeholder: "이 인사이트로 어떤 브랜드가 뭘 할 수 있을까요? 브랜드·메시지·채널을 구체적으로.",
    hint: "아이디어를 던져보세요. 직선이면 심사위원이 '왜'와 함께 꺾을 질문을 줍니다.",
  },
]

// ─── 점수 UI ────────────────────────────────────────────────────────────────────
function PrimaryScores({ scores }: { scores: InsightScores }) {
  const pivotColor = scores.pivot >= 4 ? "text-emerald-600 dark:text-emerald-400" : scores.pivot >= 3 ? "text-indigo-600 dark:text-indigo-400" : "text-yellow-600 dark:text-yellow-400"
  const clicheColor = scores.cliche <= 2 ? "text-emerald-600 dark:text-emerald-400" : scores.cliche <= 3 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
        <p className="text-xs text-gray-400 mb-1">꺾임 점수</p>
        <p className={`text-4xl font-black ${pivotColor}`}>{scores.pivot}<span className="text-lg font-bold text-gray-300">/5</span></p>
        <p className="text-xs text-gray-400 mt-1">높을수록 좋음</p>
      </div>
      <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-center">
        <p className="text-xs text-gray-400 mb-1">진부함 점수</p>
        <p className={`text-4xl font-black ${clicheColor}`}>{scores.cliche}<span className="text-lg font-bold text-gray-300">/5</span></p>
        <p className="text-xs text-gray-400 mt-1">낮을수록 좋음</p>
      </div>
    </div>
  )
}

function SecondaryScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-indigo-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400"
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-bold text-gray-700 dark:text-gray-300">{score}</span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ─── 결과 화면 ──────────────────────────────────────────────────────────────────
function ResultView({ feedback, onSave, noteSaved, onRevise, onReset }: {
  feedback: InsightFeedback
  onSave: () => void
  noteSaved: boolean
  onRevise: () => void
  onReset: () => void
}) {
  const isPivoted = feedback.scores.pivot >= 3
  return (
    <div className="flex flex-col gap-6">
      {/* 판정 배너 — 직선이면 앰버, 꺾였으면 에메랄드 */}
      <div className={`px-4 py-3 rounded-2xl border ${isPivoted ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900"}`}>
        <p className={`text-sm font-bold ${isPivoted ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
          심사위원 판정: {feedback.pivotJudgment}
        </p>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">핵심 평가</p>
        <PrimaryScores scores={feedback.scores} />
      </div>

      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-100 dark:border-yellow-900">
        <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">이번 훈련 획득 포인트</span>
        <span className="text-lg font-black text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <Star className="w-4 h-4" />+{feedback.xp}
        </span>
      </div>

      {/* 진부함 분석 — 왜 그렇게 봤는지 (네 답 근거) */}
      {feedback.clicheReason && (
        <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">왜 이렇게 봤나</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.clicheReason}</p>
          {feedback.clicheWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {feedback.clicheWords.map(w => (
                <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{w}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 다음으로 밀어주는 질문 — 직선이면 꺾기 질문, 꺾였으면 더 깊이 */}
      {feedback.reframeQuestion && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">{isPivoted ? "한 단계 더 — 생각해볼 질문" : "여기서 꺾어보세요"}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.reframeQuestion}</p>
        </div>
      )}

      {/* 꺾기 기법 */}
      {feedback.techniqueName && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">{feedback.techniqueName}</span>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">참고할 기법</p>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{feedback.techniqueExplanation}</p>
          {feedback.techniqueExample && (
            <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 mb-1">이렇게 꺾을 수도 있습니다 (가상 예시)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">{feedback.techniqueExample}</p>
            </div>
          )}
        </div>
      )}

      {/* 보조 4축 */}
      <details className="group">
        <summary className="text-xs font-bold text-gray-400 cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-colors">보조 능력치 상세 보기</summary>
        <div className="mt-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
          <InsightRadarChart scores={feedback.scores} />
          <div className="flex flex-col gap-2 mt-4">
            {(["observation", "analysis", "insight", "strategy"] as const).map(k => (
              <SecondaryScoreBar key={k}
                label={{ observation: "관찰력", analysis: "분석력", insight: "인사이트력", strategy: "전략력" }[k]}
                score={feedback.scores[k]} />
            ))}
          </div>
        </div>
      </details>

      {/* 총평 */}
      <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">심사위원 총평</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.summary}</p>
        {feedback.tips.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {feedback.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-indigo-400 mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 액션 — 피드백 반영해 다시 쓰기(선택) / 저장 / 새 훈련 */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onRevise}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          <Pencil className="w-4 h-4" /> 피드백 반영해 다시 쓰기
        </button>
        <div className="flex gap-3">
          <button onClick={onSave} disabled={noteSaved}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors">
            <BookmarkPlus className="w-4 h-4" />{noteSaved ? "저장됨" : "노트에 저장"}
          </button>
          <button onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <RotateCcw className="w-4 h-4" /> 새 훈련
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────────
interface Props {
  article: { title: string; summary: string }
  challengeId?: string
  customArticleText?: string
  onComplete?: (feedback: InsightFeedback) => void
}

export default function AnalysisFlow({ article, challengeId, customArticleText, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<AnswerState>(EMPTY_ANSWERS)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<InsightFeedback | null>(null)
  const [reviseHint, setReviseHint] = useState("") // 다시쓰기 시 직전 꺾기 질문 표시
  const [error, setError] = useState("")
  const [articleExpanded, setArticleExpanded] = useState(true)
  const [noteSaved, setNoteSaved] = useState(false)

  const step = STEPS[stepIdx]
  const total = STEPS.length
  const isLast = stepIdx === total - 1
  const canNext = (answers[step.fieldKey] ?? "").trim().length >= step.minLen

  async function handleSubmit() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/insight-lab/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, customArticle: customArticleText, answers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "심사 실패")
      setFeedback(json.feedback)
      onComplete?.(json.feedback)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요")
    } finally {
      setLoading(false)
    }
  }

  async function saveAsNote() {
    try {
      await fetch("/api/insight-lab/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          observation: answers.observation,
          insight: answers.insight,
          opportunity: answers.opportunity,
          source_label: "챌린지 분석",
          tags: [],
        }),
      })
      setNoteSaved(true)
    } catch { /* silent */ }
  }

  // 피드백 반영해 다시 쓰기 — 답을 유지한 채 인사이트 단계로, 직전 꺾기 질문을 힌트로
  function revise() {
    setReviseHint(feedback?.reframeQuestion ?? "")
    setFeedback(null)
    setNoteSaved(false)
    setStepIdx(1) // 핵심 인사이트 단계
  }

  function reset() {
    setStepIdx(0); setAnswers(EMPTY_ANSWERS); setFeedback(null)
    setReviseHint(""); setError(""); setNoteSaved(false); setArticleExpanded(true)
  }

  if (feedback) {
    return <ResultView feedback={feedback} onSave={saveAsNote} noteSaved={noteSaved} onRevise={revise} onReset={reset} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 기사 아코디언 */}
      <button onClick={() => setArticleExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">분석 대상</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{article.title}</p>
          {articleExpanded && <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mt-2">{article.summary}</p>}
        </div>
        {articleExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {/* 진행 바 */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${i < stepIdx ? "bg-indigo-500" : i === stepIdx ? "bg-indigo-300" : "bg-gray-100 dark:bg-gray-800"}`} />
        ))}
      </div>

      {/* 다시쓰기 힌트 (있을 때만) */}
      {reviseHint && stepIdx >= 1 && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
          <p className="text-xs font-bold text-indigo-400 mb-1">심사위원의 질문</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{reviseHint}</p>
        </div>
      )}

      {/* 스텝 */}
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{step.emoji}</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step {stepIdx + 1} / {total}</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{step.title}</h3>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{step.hint}</p>
        </div>
        <textarea
          value={answers[step.fieldKey] ?? ""}
          onChange={e => setAnswers(prev => ({ ...prev, [step.fieldKey]: e.target.value }))}
          placeholder={step.placeholder}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-gray-300">{(answers[step.fieldKey] ?? "").length}자 (최소 {step.minLen}자)</span>
      </div>

      {/* 네비게이션 */}
      <div className="flex gap-3">
        {stepIdx > 0 && (
          <button onClick={() => setStepIdx(v => v - 1)}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">이전</button>
        )}
        {isLast ? (
          <button onClick={handleSubmit} disabled={!canNext || loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />심사 중…</> : "심사 받기"}
          </button>
        ) : (
          <button onClick={() => setStepIdx(v => v + 1)} disabled={!canNext}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">다음</button>
        )}
      </div>
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
