import InterviewSession from "@/components/InterviewSession"
import CareerRoom from "@/components/career/CareerRoom"
import { aiPaused } from "@/lib/ai/budget"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AI 모의면접 — MarkLens",
  description: "최근 마케팅 트렌드를 인용한 질문으로 연습하는 무료 모의면접. 답변 기록과 녹화로 돌아보고, AI 기능이 켜져 있을 때는 질문별 피드백과 종합 리포트도 받을 수 있어요.",
}

export default function InterviewPage() {
  const aiOff = aiPaused()
  return (
    <CareerRoom eyebrow="02 / AI INTERVIEW" title="생각을, 내 언어로." description="최신 트렌드 질문에 답하고, 답변 기록으로 돌아보세요. 나의 마케팅 관점을 말하는 연습.">
      {aiOff && <p role="note" className="ml-career-ai-off"><strong>지금은 AI 피드백과 종합 평가를 제공하지 않아요.</strong>면접 질문, 답변 기록, 답변 시간, 녹화는 그대로 이용할 수 있어요.</p>}
      <Link href="/interview/prep" className="ml-career-prep-link"><span><strong>지원할 곳이 정해졌나요?</strong> 내 경험으로 맞춤 질문 준비{aiOff && " (지금은 이용할 수 없어요)"}</span><span>↗</span></Link>
      <InterviewSession />
    </CareerRoom>
  )
}
