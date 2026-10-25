import { notFound } from "next/navigation"
import type { Metadata } from "next"
import PrivacyPolicy from "@/components/legal/PrivacyPolicy"
import { PRIVACY_FACTS, privacyReady } from "@/lib/legal/privacy"

export const metadata: Metadata = {
  title: "개인정보처리방침 — MarkLens",
  alternates: { canonical: "/privacy" },
}

// 운영자 확정 항목(src/lib/legal/privacy.ts)이 모두 채워지기 전에는 공개하지 않는다(404).
export default function PrivacyPage() {
  if (!privacyReady()) notFound()
  return <PrivacyPolicy facts={PRIVACY_FACTS} />
}
