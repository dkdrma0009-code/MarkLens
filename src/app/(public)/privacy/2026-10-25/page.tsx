import type { Metadata } from "next"
import PrivacyPolicy20261025 from "@/components/legal/PrivacyPolicy20261025"

export const metadata: Metadata = {
  title: "이전 개인정보처리방침(2026-10-25) — MarkLens",
  robots: { index: false },
}

export default function PrivacyArchivePage() {
  return <PrivacyPolicy20261025 />
}
