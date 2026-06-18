"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Loader2, Star, BookmarkPlus, RotateCcw, AlertTriangle } from "lucide-react"
import InsightRadarChart from "./InsightRadarChart"
import type { InsightFeedback, InsightScores } from "@/types/insight-lab"

// ─── 단계 정의 ─────────────────────────────────────────────────────────────────
type StepId = "step1" | "step2" | "step3" | "step4" | "linear" | "blocking" | "reframe" | "step5"

interface NormalStep {
  id: StepId
  kind: "textarea"
  title: string
  emoji: string
  placeholder: string
  hint: string
  fieldKey: keyof AnswerState
  minLen: number
}
interface BlockingStep {
  id: StepId
  kind: "blocking"
}

type Step = NormalStep | BlockingStep

type AnswerState = {
  step1: string; step2: string; step3: string; step4: string
  linearAnswer: string; reframedInsight: string; step5: string
}

const EMPTY_ANSWERS: AnswerState = {
  step1: "", step2: "", step3: "", step4: "",
  linearAnswer: "", reframedInsight: "", step5: "",
}

const REDIRECT_QUESTIONS = [
  "이 문제가 아예 생기지 않게 하려면 어떤 '판'을 옮겨야 할까?",
  "타깃이 진짜 원하는 건 '해결'이 아니라 무엇일까?",
  "다른 카테고리에 올라타면 경쟁 없이 이 욕구를 채울 수 있을까?",
]

const STEPS: Step[] = [
  {
    id: "step1", kind: "textarea", emoji: "👁", title: "현상 관찰", fieldKey: "step1", minLen: 20,
    placeholder: "이 트렌드에서 관찰되는 구체적인 현상을 적어보세요.\n예) MZ세대의 중고 명품 구매량이 전년 대비 43% 증가했으며, 특히 20대 여성이 주도하고 있다.",
    hint: "숫자, 데이터, 행동 패턴을 구체적으로 포착할수록 좋아요.",
  },
  {
    id: "step2", kind: "textarea", emoji: "🔍", title: "원인 분석", fieldKey: "step2", minLen: 20,
    placeholder: "이 현상이 나타나는 근본적인 이유는 무엇일까요?\n예) 경기 침체로 신상품 구매 부담이 커졌고, 지속가능 소비에 대한 인식도 높아졌다.",
    hint: "단순한 이유 한 가지보다, 복합적인 원인을 구조적으로 파악해보세요.",
  },
  {
    id: "step3", kind: "textarea", emoji: "💡", title: "숨은 욕구", fieldKey: "step3", minLen: 20,
    placeholder: "이 현상 뒤에 숨어있는 소비자의 진짜 욕구는 무엇일까요?\n예) '나만의 희소한 것'을 소유하고 싶은 욕구 + 가치 있는 소비를 했다는 자기 합리화",
    hint: "겉으로 드러나지 않는 심리적·사회적 욕구를 탐색해보세요.",
  },
  {
    id: "step4", kind: "textarea", emoji: "✨", title: "핵심 인사이트 (초안)", fieldKey: "step4", minLen: 20,
    placeholder: "이 모든 것을 꿰뚫는 마케팅 인사이트를 한 문장으로 정리해보세요.\n예) MZ세대에게 '중고'는 구두쇠의 선택이 아니라, 안목 있는 소비자의 정체성 표현 수단이 되었다.",
    hint: "\"~는 ~가 아니라 ~이다\" 구조로 작성하면 날카로운 인사이트가 나와요. 직선이어도 괜찮아요 — 다음 단계에서 꺾게 됩니다.",
  },
  {
    id: "linear", kind: "textarea", emoji: "💬", title: "가장 먼저 떠오른 해결책", fieldKey: "linearAnswer", minLen: 10,
    placeholder: "이 인사이트를 기반으로, 가장 먼저 머릿속에 떠오르는 브랜드 해결책은 무엇인가요?\n솔직하게 적어주세요. 정답은 없어요.",
    hint: "직관적인 첫 반응을 꺼내는 단계예요. 뻔해도 괜찮아요.",
  },
  { id: "blocking", kind: "blocking" },
  {
    id: "reframe", kind: "textarea", emoji: "🔄", title: "인사이트 다시 쓰기", fieldKey: "reframedInsight", minLen: 20,
    placeholder: "위 질문들을 바탕으로, 인사이트를 다시 써보세요.\n'문제를 푸는' 방식이 아니라 '판을 옮기는' 방식으로.",
    hint: "처음 인사이트와 어떻게 달라졌나요? 꺾임이 클수록 좋은 훈련입니다.",
  },
  {
    id: "step5", kind: "textarea", emoji: "🚀", title: "브랜드 기회", fieldKey: "step5", minLen: 20,
    placeholder: "꺾은 인사이트를 활용해 어떤 브랜드가 어떤 캠페인을 기획할 수 있을까요?\n브랜드명, 캠페인 핵심 메시지, 채널까지 구체적으로.",
    hint: "판을 옮긴 후의 새로운 경쟁 공간에서 기회를 찾아보세요.",
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
function ResultView({ feedback, answers, onSave, noteSaved, onReset }: {
  feedback: InsightFeedback
  answers: AnswerState
  onSave: () => void
  noteSaved: boolean
  onReset: () => void
}) {
  const isPivoted = feedback.scores.pivot >= 3
  return (
    <div className="flex flex-col gap-6">
      {/* 직선 판정 배너 */}
      <div className={`px-4 py-3 rounded-2xl border ${isPivoted ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900"}`}>
        <p className={`text-sm font-bold ${isPivoted ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
          심사위원 판정: {feedback.pivotJudgment}
        </p>
      </div>

      {/* 핵심 2축 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">핵심 평가</p>
        <PrimaryScores scores={feedback.scores} />
      </div>

      {/* XP */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-100 dark:border-yellow-900">
        <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">이번 훈련 획득 포인트</span>
        <span className="text-lg font-black text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <Star className="w-4 h-4" />+{feedback.xp}
        </span>
      </div>

      {/* 진부함 이유 */}
      <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">진부함 분석</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.clicheReason}</p>
        {feedback.clicheWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {feedback.clicheWords.map(w => (
              <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 꺾기 질문 */}
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">꺾기 질문 — 정답은 없어요</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.reframeQuestion}</p>
      </div>

      {/* 꺾기 기법 */}
      {feedback.techniqueName && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">{feedback.techniqueName}</span>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">이 케이스에 쓸 수 있는 기법</p>
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

      {/* 직선→꺾기 before/after */}
      {answers.linearAnswer && answers.reframedInsight && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">나의 꺾기 궤적</p>
          <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 mb-1">직선 (꺾기 전)</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{answers.linearAnswer}</p>
          </div>
          <div className="flex justify-center text-gray-300 text-sm">↓</div>
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-400 mb-1">꺾은 인사이트</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{answers.reframedInsight}</p>
          </div>
        </div>
      )}

      {/* 레이더 — 보조 4축 */}
      <details className="group">
        <summary className="text-xs font-bold text-gray-400 cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          보조 능력치 상세 보기
        </summary>
        <div className="mt-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
          <InsightRadarChart scores={feedback.scores} />
          <div className="flex flex-col gap-2 mt-4">
            {(["observation", "analysis", "insight", "strategy"] as const).map(k => (
              <SecondaryScoreBar key={k}
                label={{ observation: "관찰력", analysis: "분석력", insight: "인사이트력", strategy: "전략력" }[k]}
                score={feedback.scores[k]}
              />
            ))}
          </div>
        </div>
      </details>

      {/* 종합 코멘트 */}
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

      {/* 액션 */}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={noteSaved}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          <BookmarkPlus className="w-4 h-4" />
          {noteSaved ? "저장됨" : "노트에 저장"}
        </button>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          다시 훈련하기
        </button>
      </div>
    </div>
  )
}

// ─── 꺾기 차단 화면 ─────────────────────────────────────────────────────────────
function BlockingScreen({ linearAnswer, onContinue }: { linearAnswer: string; onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {/* 직선 답 표시 */}
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 mb-2">방금 적은 답</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">&quot;{linearAnswer}&quot;</p>
      </div>

      {/* 차단 메시지 */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">그건 문제를 &apos;푸는&apos; 답입니다.</p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
            문제가 &apos;생기는 판&apos; 자체를 옮겨보세요. 탐색이 피곤하다 → 추천 강화, 시간이 없다 → 빠르게. 이런 직선은 본선을 통과하지 못합니다.
          </p>
        </div>
      </div>

      {/* 꺾기 질문 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">이 질문들로 판을 옮겨보세요</p>
        {REDIRECT_QUESTIONS.map((q, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
            <span className="text-indigo-400 text-xs font-bold mt-0.5">Q{i + 1}</span>
            <p className="text-sm text-gray-700 dark:text-gray-300">{q}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
      >
        꺾어볼게요 →
      </button>
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
  const [error, setError] = useState("")
  const [articleExpanded, setArticleExpanded] = useState(true)
  const [noteSaved, setNoteSaved] = useState(false)

  const step = STEPS[stepIdx]
  const totalSteps = STEPS.length
  // blocking은 진행 바에서 제외
  const visibleTotal = STEPS.filter(s => s.kind !== "blocking").length
  const visibleIdx = STEPS.slice(0, stepIdx + 1).filter(s => s.kind !== "blocking").length - 1
  const isLast = stepIdx === totalSteps - 1
  const canNext = step?.kind === "blocking"
    ? true
    : (answers[(step as NormalStep)?.fieldKey] ?? "").trim().length >= ((step as NormalStep)?.minLen ?? 10)

  function handleAnswer(val: string) {
    if (!step || step.kind !== "textarea") return
    setAnswers(prev => ({ ...prev, [(step as NormalStep).fieldKey]: val }))
  }

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
      if (!res.ok) throw new Error(json.error ?? "평가 실패")
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
          observation: answers.step1,
          cause: answers.step2,
          desire: answers.step3,
          insight: answers.reframedInsight || answers.step4,
          opportunity: answers.step5,
          source_label: "챌린지 분석",
          tags: [],
        }),
      })
      setNoteSaved(true)
    } catch { /* silent */ }
  }

  function reset() {
    setStepIdx(0); setAnswers(EMPTY_ANSWERS); setFeedback(null)
    setError(""); setNoteSaved(false); setArticleExpanded(true)
  }

  // 결과 화면
  if (feedback) {
    return <ResultView feedback={feedback} answers={answers} onSave={saveAsNote} noteSaved={noteSaved} onReset={reset} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 기사 아코디언 */}
      <button
        onClick={() => setArticleExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">분석 대상</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{article.title}</p>
          {articleExpanded && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mt-2">{article.summary}</p>
          )}
        </div>
        {articleExpanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        }
      </button>

      {/* 진행 바 (blocking 제외) */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: visibleTotal }).map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${i < visibleIdx ? "bg-indigo-500" : i === visibleIdx ? "bg-indigo-300" : "bg-gray-100 dark:bg-gray-800"}`} />
        ))}
      </div>

      {/* 스텝 내용 */}
      {step?.kind === "blocking" ? (
        <BlockingScreen
          linearAnswer={answers.linearAnswer}
          onContinue={() => setStepIdx(v => v + 1)}
        />
      ) : step?.kind === "textarea" ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{step.emoji}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step {visibleIdx + 1} / {visibleTotal}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{step.title}</h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{step.hint}</p>
          </div>
          <textarea
            value={answers[step.fieldKey] ?? ""}
            onChange={e => handleAnswer(e.target.value)}
            placeholder={step.placeholder}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-300">{(answers[step.fieldKey] ?? "").length}자 (최소 {step.minLen}자)</span>
        </div>
      ) : null}

      {/* 네비게이션 (blocking은 자체 버튼 사용) */}
      {step?.kind !== "blocking" && (
        <div className="flex gap-3">
          {stepIdx > 0 && (
            <button
              onClick={() => setStepIdx(v => v - 1)}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              이전
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={!canNext || loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />심사 중…</> : "심사 받기"}
            </button>
          ) : (
            <button
              onClick={() => setStepIdx(v => v + 1)}
              disabled={!canNext}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              다음
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
