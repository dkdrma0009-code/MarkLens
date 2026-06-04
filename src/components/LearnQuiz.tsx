"use client"

import { useState } from "react"
import { CheckCircle, XCircle, ChevronRight, RotateCcw, BookOpen } from "lucide-react"

type QuestionType = "multiple_choice" | "short_answer"

interface Question {
  type: QuestionType
  question: string
  options?: string[]
  answer: number | string
  explanation: string
}

type Stage = "settings" | "loading" | "quiz" | "result"

const COUNT_OPTIONS = [5, 10, 20]
const LEVELS = [
  { key: "beginner", label: "입문", desc: "기본 개념 위주" },
  { key: "intermediate", label: "중급", desc: "실무 적용 수준" },
  { key: "advanced", label: "고급", desc: "전략적 사고 수준" },
]
const TYPES = [
  { key: "multiple_choice", label: "객관식만" },
  { key: "short_answer", label: "단답형만" },
  { key: "mixed", label: "혼합" },
]

export default function LearnQuiz() {
  const [stage, setStage] = useState<Stage>("settings")
  const [count, setCount] = useState(10)
  const [level, setLevel] = useState("intermediate")
  const [type, setType] = useState("mixed")
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [results, setResults] = useState<(boolean | null)[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [shortInput, setShortInput] = useState("")
  const [grading, setGrading] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  async function start() {
    setStage("loading")
    try {
      const res = await fetch("/api/learn/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, level, type }),
      })
      const data = await res.json()
      if (!data.questions?.length) throw new Error()
      setQuestions(data.questions)
      setResults(new Array(data.questions.length).fill(null))
      setCurrent(0)
      setAnswered(false)
      setSelected(null)
      setShortInput("")
      setIsCorrect(null)
      setStage("quiz")
    } catch {
      setStage("settings")
      alert("문제 생성에 실패했습니다. 다시 시도해주세요.")
    }
  }

  function handleChoice(i: number) {
    if (answered) return
    setSelected(i)
    const q = questions[current]
    const correct = i === q.answer
    setIsCorrect(correct)
    setAnswered(true)
    const newResults = [...results]
    newResults[current] = correct
    setResults(newResults)
  }

  async function handleShortSubmit() {
    if (!shortInput.trim() || grading) return
    setGrading(true)
    const q = questions[current]
    try {
      const res = await fetch("/api/learn/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, correctAnswer: q.answer, userAnswer: shortInput }),
      })
      const data = await res.json()
      const correct = data.result === "correct"
      setIsCorrect(correct)
      setAnswered(true)
      const newResults = [...results]
      newResults[current] = correct
      setResults(newResults)
    } catch {
      setIsCorrect(false)
      setAnswered(true)
    } finally {
      setGrading(false)
    }
  }

  function next() {
    if (current + 1 >= questions.length) {
      setStage("result")
    } else {
      setCurrent(current + 1)
      setSelected(null)
      setShortInput("")
      setAnswered(false)
      setIsCorrect(null)
    }
  }

  function reset() {
    setStage("settings")
    setQuestions([])
    setResults([])
    setCurrent(0)
  }

  const q = questions[current]
  const score = results.filter(Boolean).length

  // ── 설정 화면 ──
  if (stage === "settings") return (
    <div className="space-y-8">
      <Setting label="문제 수">
        <div className="flex gap-3">
          {COUNT_OPTIONS.map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-all ${count === n ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {n}문제
            </button>
          ))}
        </div>
      </Setting>

      <Setting label="난이도">
        <div className="flex gap-3">
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevel(l.key)}
              className={`flex-1 py-3 px-2 rounded-xl border-2 transition-all ${level === l.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              <p className="text-sm font-bold">{l.label}</p>
              <p className={`text-xs mt-0.5 ${level === l.key ? "text-white/70 dark:text-black/60" : "text-gray-400"}`}>{l.desc}</p>
            </button>
          ))}
        </div>
      </Setting>

      <Setting label="문제 유형">
        <div className="flex gap-3">
          {TYPES.map(t => (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${type === t.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </Setting>

      <button onClick={start}
        className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold hover:opacity-90 transition-opacity">
        시작하기
      </button>
    </div>
  )

  // ── 로딩 ──
  if (stage === "loading") return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p className="text-gray-500 text-base">AI가 문제를 생성하고 있어요...</p>
    </div>
  )

  // ── 퀴즈 화면 ──
  if (stage === "quiz" && q) return (
    <div>
      {/* 진행률 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400 font-medium">{current + 1} / {questions.length}</span>
        <span className="text-sm text-gray-400">{q.type === "multiple_choice" ? "객관식" : "단답형"}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mb-8">
        <div className="h-full bg-black dark:bg-white rounded-full transition-all"
          style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {/* 문제 */}
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-6">{q.question}</p>

      {/* 객관식 */}
      {q.type === "multiple_choice" && (
        <div className="space-y-3">
          {q.options?.map((opt, i) => {
            let cls = "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 cursor-pointer"
            if (answered) {
              if (i === q.answer) cls = "border-emerald-400 bg-emerald-50 dark:bg-emerald-950 cursor-default"
              else if (i === selected) cls = "border-red-300 bg-red-50 dark:bg-red-950 cursor-default"
              else cls = "border-gray-100 dark:border-gray-800 opacity-40 cursor-default"
            }
            return (
              <button key={i} onClick={() => handleChoice(i)} disabled={answered}
                className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all text-base text-gray-700 dark:text-gray-300 ${cls}`}>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* 단답형 */}
      {q.type === "short_answer" && (
        <div className="space-y-3">
          <input
            value={shortInput}
            onChange={e => setShortInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !answered && handleShortSubmit()}
            disabled={answered || grading}
            placeholder="답을 입력하세요"
            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-60"
          />
          {!answered && (
            <button onClick={handleShortSubmit} disabled={!shortInput.trim() || grading}
              className="w-full py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 hover:opacity-90 transition-opacity">
              {grading ? "채점 중..." : "제출"}
            </button>
          )}
        </div>
      )}

      {/* 정답/오답 결과 */}
      {answered && (
        <div className={`mt-5 rounded-2xl p-5 ${isCorrect ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"}`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect
              ? <CheckCircle className="w-5 h-5 text-emerald-600" />
              : <XCircle className="w-5 h-5 text-red-500" />}
            <p className={`text-sm font-bold ${isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {isCorrect ? "정답입니다! 🎉" : `오답입니다. 정답: ${q.type === "multiple_choice" ? q.options?.[q.answer as number] : q.answer}`}
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{q.explanation}</p>
        </div>
      )}

      {/* 다음 버튼 */}
      {answered && (
        <button onClick={next}
          className="w-full mt-4 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
          {current + 1 >= questions.length ? "결과 보기" : "다음 문제"}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )

  // ── 결과 화면 ──
  if (stage === "result") return (
    <div>
      {/* 점수 */}
      <div className="text-center py-10 border border-gray-100 dark:border-gray-800 rounded-2xl mb-8">
        <p className="text-6xl font-black text-gray-900 dark:text-gray-100 mb-2">{score}<span className="text-3xl text-gray-400">/{questions.length}</span></p>
        <p className="text-gray-500 text-base">
          {score === questions.length ? "완벽해요! 🏆" : score >= questions.length * 0.7 ? "잘 하셨어요! 👍" : "더 공부해봐요 📚"}
        </p>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <span className="text-emerald-600 font-medium">✓ 정답 {score}개</span>
          <span className="text-red-500 font-medium">✗ 오답 {questions.length - score}개</span>
        </div>
      </div>

      {/* 틀린 문제 */}
      {results.some(r => r === false) && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">틀린 문제 다시 보기</h2>
          <div className="space-y-4">
            {questions.map((q, i) => results[i] === false && (
              <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <p className="text-xs font-bold text-gray-400 mb-2">문제 {i + 1}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{q.question}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                  정답: {q.type === "multiple_choice" ? q.options?.[q.answer as number] : q.answer}
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">{q.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3">
        <button onClick={start}
          className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> 같은 설정으로 다시
        </button>
        <button onClick={reset}
          className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <BookOpen className="w-4 h-4" /> 새 문제 시작
        </button>
      </div>
    </div>
  )

  return null
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{label}</p>
      {children}
    </div>
  )
}
