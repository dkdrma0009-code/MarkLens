import { notFound } from "next/navigation"
import type { Metadata } from "next"
import PrivacyPolicy20261025 from "@/components/legal/PrivacyPolicy20261025"
import { PRIVACY_FACTS, privacyReady } from "@/lib/legal/privacy"

export const metadata: Metadata = {
  title: "이전 개인정보처리방침(2026-10-25) — MarkLens",
  robots: { index: false },
}

export default function PrivacyArchivePage() {
  if (!privacyReady()) notFound()
  return <PrivacyPolicy20261025 facts={{ ...PRIVACY_FACTS, effectiveDate: "2026-10-25" }} />
}
