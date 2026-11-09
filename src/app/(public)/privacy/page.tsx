import type { Metadata } from "next"
import PrivacyPolicy from "@/components/legal/PrivacyPolicy"
import PrivacyPolicy20261025 from "@/components/legal/PrivacyPolicy20261025"
import { PRIVACY_FACTS, privacyRevisionReady } from "@/lib/legal/privacy"

export const metadata: Metadata = {
  title: "개인정보처리방침 — MarkLens",
  alternates: { canonical: "/privacy" },
}

// 개정본의 운영자 확정 항목(src/lib/legal/privacy.ts)이 모두 채워지기 전에는 시행 중인 방침을 계속 보여 준다. 숨기지 않는다.
export default function PrivacyPage() {
  return privacyRevisionReady() ? <PrivacyPolicy facts={PRIVACY_FACTS} /> : <PrivacyPolicy20261025 />
}
