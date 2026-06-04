"use client"

import { useState } from "react"

interface Question {
  question: string
  options: string[]
  answer: number
  explanation: string
}

interface QuizFormat {
  questions?: Question[]
  question?: string
  options?: string[]
  answer?: number
  explanation?: string
}

export default function InsightQuiz({ quiz, color }: { quiz: QuizFormat; color: string }) {
  // questions 배열 또는 flat format 모두 처리
  const q: Question | undefined = quiz?.questions?.[0] ?? (quiz?.question ? (quiz as unknown as Question) : undefined)
  const [selected, setSelected] = useState<number | null>(null)

  if (!q) return null

  const isAnswered = selected !== null
  const isCorrect = selected === q.answer

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: color + "0e" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>
          마케팅 학습하기
        </p>
        <p className="text-lg font-semibold text-gray-900 leading-snug">{q.question}</p>
      </div>

      {/* Options */}
      <div className="p-4 space-y-2.5">
        {q.options.map((option, i) => {
          let cls = "border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
          if (isAnswered) {
            if (i === q.answer) cls = "border-emerald-400 bg-emerald-50 cursor-default"
            else if (i === selected) cls = "border-red-300 bg-red-50 cursor-default"
            else cls = "border-gray-100 bg-white opacity-40 cursor-default"
          }
          return (
            <button
              key={i}
              onClick={() => !isAnswered && setSelected(i)}
              disabled={isAnswered}
              className={`w-full text-left px-5 py-3.5 rounded-xl border-2 transition-all text-base text-gray-700 ${cls}`}
            >
              {option}
            </button>
          )
        })}
      </div>

      {/* Result */}
      {isAnswered && (
        <div className={`mx-4 mb-4 rounded-xl p-4 ${isCorrect ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className={`text-sm font-bold mb-1.5 ${isCorrect ? "text-emerald-700" : "text-red-600"}`}>
            {isCorrect ? "정답입니다! 🎉" : `오답입니다. 정답은 ${q.options[q.answer]}입니다.`}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">{q.explanation}</p>
        </div>
      )}
    </div>
  )
}
