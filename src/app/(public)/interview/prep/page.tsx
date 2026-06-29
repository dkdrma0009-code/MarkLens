import PrepInterviewClient from "@/components/PrepInterviewClient"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "맞춤 면접 준비 — MarkLens",
  description: "자기소개서와 채용공고를 분석해 실제 면접관이 물어볼 법한 맞춤 질문을 만들고 AI 피드백까지 받아보세요.",
}

export default function PrepInterviewPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-10">
        <Link href="/interview" className="text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-block">
          ← 일반 모의면접으로 돌아가기
        </Link>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">맞춤 면접 준비</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          내 자소서로 면접 질문 만들기
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          자기소개서와 채용공고를 붙여넣으면, AI가 실제 면접관처럼 구체적인 질문을 만들어요.
          경험을 파고드는 질문에 답하고 피드백을 받아보세요.
        </p>
      </div>
      <PrepInterviewClient />
    </div>
  )
}
