import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, Mic, ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "면접 준비 — MarkLens",
  description: "마케팅 트렌드 퀴즈로 워밍업하고, AI 모의면접으로 실전 감각을 키우세요.",
  alternates: { canonical: "/practice" },
}

export default function PracticePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-12">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">면접 준비</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          퀴즈 워밍업 → AI 실전 면접
        </h1>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          마케팅 트렌드 감각을 퀴즈로 먼저 점검하고,
          AI와의 모의면접으로 답변 완성도를 높이세요.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Link
          href="/learn"
          className="group flex items-start gap-5 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">학습 퀴즈</h2>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              최근 마케팅 인사이트에서 출제되는 문제로 트렌드 감각을 테스트해보세요.
              면접 전 워밍업으로 딱 맞는 5분 루틴이에요.
            </p>
          </div>
        </Link>

        <Link
          href="/interview"
          className="group flex items-start gap-5 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Mic className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 모의면접</h2>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              실제 마케팅 직군 면접관처럼 질문하는 AI와 실시간으로 연습하세요.
              답변 후 즉시 피드백과 개선 방향을 받을 수 있어요.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
