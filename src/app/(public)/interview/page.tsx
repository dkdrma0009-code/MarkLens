import InterviewSession from "@/components/InterviewSession"
import CareerRoom from "@/components/career/CareerRoom"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AI 모의면접 — MarkLens",
  description: "최근 마케팅 트렌드를 인용한 질문으로 연습하는 무료 AI 모의면접. 질문별 피드백과 종합 리포트까지.",
}

export default function InterviewPage() {
  return (
    <CareerRoom eyebrow="02 / AI INTERVIEW" title="생각을, 내 언어로." description="최신 트렌드 질문에 답하고, 피드백으로 다듬으세요. 나의 마케팅 관점을 말하는 연습.">
      <Link href="/interview/prep" className="ml-career-prep-link"><span><strong>지원할 곳이 정해졌나요?</strong> 내 경험으로 맞춤 질문 준비</span><span>↗</span></Link>
      <InterviewSession />
    </CareerRoom>
  )
}
