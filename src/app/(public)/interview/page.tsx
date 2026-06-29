import InterviewSession from "@/components/InterviewSession"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AI 모의면접 — MarkLens",
  description: "최근 마케팅 트렌드를 인용한 질문으로 연습하는 무료 AI 모의면접. 질문별 피드백과 종합 리포트까지.",
}

export default function InterviewPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-10">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">AI 모의면접</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          마케팅 면접, 실전처럼 연습하세요
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          최근 트렌드를 인용한 질문에 답하고, 질문마다 피드백을 받아보세요. 끝나면 종합 리포트와 &lsquo;면접 한 마디&rsquo;를 드려요.
        </p>
      </div>

      <Link
        href="/interview/prep"
        className="flex items-start gap-4 mb-8 p-5 rounded-2xl border-2 border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
      >
        <div className="text-2xl">✨</div>
        <div>
          <p className="font-bold text-base">내 자소서로 맞춤 질문 만들기</p>
          <p className="text-sm opacity-70 mt-0.5">
            자기소개서 + 채용공고를 분석해 실제 면접관처럼 구체적인 질문을 생성해요
          </p>
        </div>
        <div className="ml-auto text-xl opacity-60 self-center">→</div>
      </Link>

      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">또는 일반 모의면접 시작하기</p>
      </div>

      <InterviewSession />
    </div>
  )
}
