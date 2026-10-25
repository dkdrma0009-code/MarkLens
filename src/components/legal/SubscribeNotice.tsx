import Link from "next/link"
import { PRIVACY_FACTS, privacyReady, type PrivacyFacts } from "@/lib/legal/privacy"

// 구독 폼 아래 개인정보 수집·이용 고지(R-4). 운영자 확정 항목이 모두 채워지기 전에는 아무것도 그리지 않는다
// (지금의 폼 그대로). 해지는 발송 중단 + 보유 기간 뒤 파기로 안내한다 — 즉시 삭제처럼 말하지 않는다.
export default function SubscribeNotice({ id, facts = PRIVACY_FACTS }: { id: string; facts?: PrivacyFacts }) {
  if (!privacyReady(facts)) return null
  return (
    <p id={id} className="ml-form-note ml-privacy-note">
      이메일 주소는 MarkLens 뉴스레터와 구독 확인 메일 발송에만 사용합니다. 구독을 해지하면 발송이 바로 멈추고, 기록은 {facts.retention.subscribers} 보관 후 파기합니다.{" "}
      <Link href="/privacy">개인정보처리방침</Link>
    </p>
  )
}
