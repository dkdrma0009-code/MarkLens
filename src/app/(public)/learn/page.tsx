import LearnQuiz from "@/components/LearnQuiz"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "마케팅 트렌드 퀴즈 — MarkLens",
  description: "이번 주 마케팅 트렌드를 얼마나 따라잡았는지 퀴즈로 테스트해보세요",
}

export default function LearnPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-10">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">마케팅 학습하기</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          이번 주 트렌드, 얼마나 따라잡았나요?
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          최근 마케팅 인사이트에서 출제되는 문제로 트렌드 감각을 테스트해보세요. 면접 전 워밍업으로 딱이에요.
        </p>
      </div>
      <LearnQuiz />
    </div>
  )
}
