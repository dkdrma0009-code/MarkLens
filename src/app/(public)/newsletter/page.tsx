import type { Metadata } from "next"
import NewsletterClient from "./NewsletterClient"

export const metadata: Metadata = {
  title: "MarkLens Weekly — 한 주의 변화를, 하나의 관점으로",
  description: "한 주제를 깊게 읽고, 마케터에게 중요한 의미와 면접·포트폴리오로 연결할 관점을 받아보세요. 무료 마케팅 브리핑, MarkLens Weekly.",
  alternates: { canonical: "/newsletter" },
}

export default function NewsletterPage() {
  return <NewsletterClient />
}
