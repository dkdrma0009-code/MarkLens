import PrepInterviewClient from "@/components/PrepInterviewClient"
import CareerRoom from "@/components/career/CareerRoom"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "맞춤 면접 준비 — MarkLens",
  description: "자기소개서와 채용공고를 분석해 실제 면접관이 물어볼 법한 맞춤 질문을 만들고 AI 피드백까지 받아보세요.",
}

export default function PrepInterviewPage() {
  return (
    <CareerRoom eyebrow="PREPARE YOUR INTERVIEW" title="내 경험에서 시작하는 면접." description="지원 직무와 경험을 정리하세요. 자기소개서와 채용공고를 바탕으로 맞춤 질문을 준비합니다.">
      <p className="ml-career-process">01 지원 직무 · 02 경험과 준비 내용 · 03 맞춤 질문</p>
      <PrepInterviewClient />
      <Link href="/interview" className="ml-career-next">← 일반 모의면접으로 돌아가기</Link>
    </CareerRoom>
  )
}
