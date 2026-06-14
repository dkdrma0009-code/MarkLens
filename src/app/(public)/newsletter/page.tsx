import type { Metadata } from "next"
import NewsletterClient from "./NewsletterClient"

export const metadata: Metadata = {
  title: "뉴스레터 구독 — MarkLens",
  description: "매주 월요일 7:30 AM, 글로벌 마케팅 트렌드·실무 적용법·포트폴리오 활용 팁을 담은 마케팅 브리핑을 받아보세요.",
  alternates: { canonical: "/newsletter" },
}

export default function NewsletterPage() {
  return <NewsletterClient />
}
