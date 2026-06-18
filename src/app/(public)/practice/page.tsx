import type { Metadata } from "next"
import Link from "next/link"
import { BookOpen, Mic, Lightbulb, ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "면접 준비 — MarkLens",
  description: "마케팅 트렌드 퀴즈로 워밍업하고, AI 모의면접과 인사이트 분석으로 실전 감각을 키우세요.",
  alternates: { canonical: "/practice" },
}

const CARDS = [
  {
    href: "/learn",
    icon: <BookOpen className="w-6 h-6" />,
    title: "학습 퀴즈",
    description: "최근 마케팅 인사이트에서 출제되는 문제로 트렌드 감각을 테스트해보세요. 면접 전 워밍업으로 딱 맞는 5분 루틴이에요.",
  },
  {
    href: "/interview",
    icon: <Mic className="w-6 h-6" />,
    title: "AI 모의면접",
    description: "실제 마케팅 직군 면접관처럼 질문하는 AI와 실시간으로 연습하세요. 답변 후 즉시 피드백과 개선 방향을 받을 수 있어요.",
  },
  {
    href: "/insight-lab",
    icon: <Lightbulb className="w-6 h-6" />,
    title: "인사이트 분석",
    description: "트렌드를 5단계로 직접 분석하고 AI 평가를 받아보세요. 관찰력·분석력·인사이트력·전략력을 체계적으로 키울 수 있어요.",
    badge: "NEW",
  },
]

export default function PracticePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="mb-12">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">면접 준비</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          퀴즈 → AI 면접 → 인사이트 트레이닝
        </h1>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          마케팅 트렌드 감각을 퀴즈로 점검하고, AI 면접·인사이트 분석으로 실전 역량을 쌓으세요.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-5 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              {card.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{card.title}</h2>
                  {card.badge && (
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                      {card.badge}
                    </span>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
