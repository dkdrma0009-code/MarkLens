// 개인정보처리방침의 운영자 확정 항목(R-4). 하나라도 비어 있거나 검토가 끝나지 않으면 /privacy 페이지, 구독 폼 고지,
// 푸터 링크가 공개되지 않는다 — 미확정 법적 정보를 완성된 처리방침처럼 내보내지 않기 위해서다. 값은 운영자가 확정해
// 채우고, 문안은 운영자·법률 검토를 거친다(docs/release/privacy-policy-draft.md). 임의의 값을 넣지 않는다.
export interface PrivacyFacts {
  /** 운영 형태. 개인 운영이면 대표자 항목이 없다 */
  operatorType: "individual" | "business" | null
  /** 운영 주체 표기(개인이면 운영자 표기, 사업자면 사업자명) */
  operator: string | null
  /** 대표자(사업자일 때만) */
  representative: string | null
  /** 정보주체 요청·문의 메일 주소 */
  contactEmail: string | null
  /** 문의 메일이 실제로 운영자에게 도착하는지 확인했는가(전달 설정 후 시험 메일로 확인) */
  contactInboxVerified: boolean
  /** 개인정보 보호책임자 표기(성명 공개가 법적으로 필요한지 확인 후 운영자가 정한다) */
  privacyOfficer: string | null
  /** 시행일 (YYYY-MM-DD) — 새 버전을 실제로 공개하는 날 */
  effectiveDate: string | null
  /** 보유 기간 문구. 기간 숫자는 src/lib/privacy/retention.ts 와 같아야 한다(tests/privacy-retention.test.mjs) */
  retention: { subscribers: string | null; newsletterEvents: string | null; members: string | null; feedback: string | null; aiUsage: string | null }
  /** 보유 기간이 지난 기록을 실제로 파기하는 절차 */
  disposalProcess: string | null
  /** 다른 법령에 따라 따로 보관하는 정보와 근거·기간(법률 검토 후). 없으면 그 사실을 적는다 */
  lawfulRetention: string | null
  /** Supabase 데이터 저장 리전 */
  databaseRegion: string | null
  /** 법률 검토 결과: 뉴스레터에 별도 광고성 정보 수신 동의가 필요한가. "separate-consent"는 동의 UI가 아직 없어 공개 불가 */
  marketingConsent: "notice-only" | "separate-consent" | null
  /** 국외 이전(Vercel·Google·Anthropic·OpenAI·Brevo) 고지 문구 법률 검토 완료 */
  overseasTransferReviewed: boolean
}

// 2026-10-25 운영자 확정: 개인 운영, 서비스명 MarkLens, 보호책임자는 운영자 본인, 문의는 newsletter@marklens.site
// (네이버 관리자 메일로 자동 전달), 보관 기준은 src/lib/privacy/retention.ts. 아직 null/false 인 것은 확인 대기다.
export const PRIVACY_FACTS: PrivacyFacts = {
  operatorType: "individual",
  operator: "MarkLens",
  representative: null,
  contactEmail: "newsletter@marklens.site",
  contactInboxVerified: false, // MX 레코드가 아직 없다 — 전달 설정과 시험 메일 확인 후 true
  privacyOfficer: null, // 운영자 본인. 성명 공개 필요 여부 확인 후 표기를 정한다(임의로 쓰지 않는다)
  effectiveDate: null, // 공개하는 커밋에서 그날 날짜로 채운다
  retention: {
    subscribers: "구독을 해지하면 즉시 삭제(이메일 확인을 마치지 않은 신청은 7일 뒤 삭제)",
    newsletterEvents: "90일",
    members: "회원 탈퇴(계정 삭제) 시 즉시 삭제",
    feedback: "접수 후 6개월",
    aiUsage: "90일",
  },
  disposalProcess: "보관 기간이 지난 기록은 매일 자동으로 삭제하고, 운영자가 매월 1회 삭제 결과를 확인합니다. 삭제 요청은 정기 확인을 기다리지 않고 바로 처리합니다. 데이터베이스에서 복구할 수 없도록 삭제하며, 운영자가 보관하는 백업 파일은 만든 날부터 90일이 지나면 삭제합니다.",
  // 결제·판매가 없는 개인 운영 사이트라 다른 법령의 보관 의무 대상 기록이 없다(2026-10-25 확인).
  lawfulRetention: "다른 법령에 따라 따로 보관하는 개인정보는 없습니다.",
  databaseRegion: "대한민국 서울(AWS ap-northeast-2)", // 운영 프로젝트 Session pooler 호스트로 확인(2026-10-25)
  // 정보통신망법 제50조의 사전 동의는 영리목적 광고성 정보에 적용된다. 뉴스레터에는 광고·판매·제휴 내용이 없고(코드 확인),
  // 구독은 본인이 직접 신청하고 확인 메일로 한 번 더 확인하며, 모든 메일에 발신자와 수신거부 링크가 있다. 광고를 싣게 되면
  // 기존 구독을 광고 동의로 보지 않고 별도 수신 동의를 받는다(처리방침에 명시). 변호사 검토가 아닌 법 조문 기준 확인이다.
  marketingConsent: "notice-only",
  // 처리방침 3절이 법 제28조의8 제2항 항목(이전 항목·국가·시기와 방법·받는 자와 연락처·목적과 보유 기간)을 모두 담는지
  // 조문 기준으로 대조했다(2026-10-25). 변호사 검토가 아닌 법 조문 기준 확인이다.
  overseasTransferReviewed: true,
}

/** Brevo 발송의 회신 주소. 발신 주소 newsletter@marklens.site 는 메일을 받을 수 없어(MX 없음) 회신이 사라지므로,
 *  문의 메일이 확정되면 그 주소로 회신이 가게 한다. 확정 전에는 아무것도 더하지 않는다. */
export function mailReplyTo(f: PrivacyFacts = PRIVACY_FACTS): { replyTo?: { email: string; name: string } } {
  return f.contactEmail ? { replyTo: { email: f.contactEmail, name: "MarkLens" } } : {}
}

/** 공개를 막고 있는 항목(사람이 읽는 이름). 비어 있으면 공개 가능. */
export function missingPrivacyFacts(f: PrivacyFacts = PRIVACY_FACTS): string[] {
  const missing: string[] = []
  const need = (ok: unknown, name: string) => { if (!ok) missing.push(name) }
  need(f.operatorType, "운영 형태")
  need(f.operator, "운영 주체")
  if (f.operatorType === "business") need(f.representative, "대표자")
  need(f.contactEmail, "문의 메일")
  need(f.contactInboxVerified, "문의 메일 수신 확인")
  need(f.privacyOfficer, "개인정보 보호책임자")
  need(f.effectiveDate, "시행일")
  need(f.retention.subscribers, "보유 기간: 구독자")
  need(f.retention.newsletterEvents, "보유 기간: 뉴스레터 발송 기록")
  need(f.retention.members, "보유 기간: Insight Lab 회원")
  need(f.retention.feedback, "보유 기간: 피드백")
  need(f.retention.aiUsage, "보유 기간: AI 사용량 기록")
  need(f.disposalProcess, "보유 기간 경과 기록 파기 절차")
  need(f.lawfulRetention, "법령에 따른 별도 보관(법률 검토)")
  need(f.databaseRegion, "데이터 저장 리전")
  need(f.marketingConsent, "광고성 정보 동의 필요 여부(법률 검토)")
  if (f.marketingConsent === "separate-consent") missing.push("광고성 정보 별도 동의 UI(미구현)")
  need(f.overseasTransferReviewed, "국외 이전 고지 법률 검토")
  return missing
}

export const privacyReady = (f: PrivacyFacts = PRIVACY_FACTS) => missingPrivacyFacts(f).length === 0
