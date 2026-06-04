import LearnQuiz from "@/components/LearnQuiz"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "마케팅 학습하기 — MarkLens",
  description: "마케팅 전반 지식을 테스트하는 AI 학습 공간",
}

export default function LearnPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-10">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">마케팅 학습하기</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          마케팅 실력을 테스트해보세요
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          AI가 실시간으로 생성하는 마케팅 문제를 풀며 실력을 키워보세요.
        </p>
      </div>
      <LearnQuiz />
    </div>
  )
}
