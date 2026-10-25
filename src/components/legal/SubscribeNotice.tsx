import Link from "next/link"
import { PRIVACY_FACTS, privacyReady, type PrivacyFacts } from "@/lib/legal/privacy"

// 구독 폼 아래 개인정보 수집·이용 고지(R-4). 운영자 확정 항목이 모두 채워지기 전에는 아무것도 그리지 않는다
// (지금의 폼 그대로). 보관 문구는 처리방침과 같은 facts에서 온다 — 해지 = 즉시 삭제(/api/unsubscribe).
export default function SubscribeNotice({ id, facts = PRIVACY_FACTS }: { id: string; facts?: PrivacyFacts }) {
  if (!privacyReady(facts)) return null
  return (
    <p id={id} className="ml-form-note ml-privacy-note">
      이메일 주소는 MarkLens 뉴스레터와 구독 확인 메일 발송에만 사용합니다. 보관: {facts.retention.subscribers}.{" "}
      <Link href="/privacy">개인정보처리방침</Link>
    </p>
  )
}
