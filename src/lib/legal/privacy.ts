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
  /** 개인정보 보호책임자(성명·직책) */
  privacyOfficer: string | null
  /** 시행일 (YYYY-MM-DD) */
  effectiveDate: string | null
  /** 보유 기간 문구, 예: "구독 해지 후 30일" */
  retention: { subscribers: string | null; members: string | null; feedback: string | null; aiUsage: string | null }
  /** 보유 기간이 지난 기록을 실제로 파기하는 절차(현재 코드에는 없다: 해지는 상태만 바꾸고 행을 남긴다) */
  disposalProcess: string | null
  /** Supabase 데이터 저장 리전 */
  databaseRegion: string | null
  /** 법률 검토 결과: 뉴스레터에 별도 광고성 정보 수신 동의가 필요한가. "separate-consent"는 동의 UI가 아직 없어 공개 불가 */
  marketingConsent: "notice-only" | "separate-consent" | null
  /** 국외 이전(Vercel·Google·Anthropic·OpenAI·Brevo) 고지 문구 법률 검토 완료 */
  overseasTransferReviewed: boolean
}

export const PRIVACY_FACTS: PrivacyFacts = {
  operatorType: "individual", // 2026-10-25 운영자 확정: 사업자가 아닌 개인 운영
  operator: null,
  representative: null,
  contactEmail: null, // newsletter@marklens.site 는 MX 레코드가 없어 메일을 받을 수 없다(2026-10-25 DNS 확인)
  privacyOfficer: null,
  effectiveDate: null,
  retention: { subscribers: null, members: null, feedback: null, aiUsage: null },
  disposalProcess: null,
  databaseRegion: "대한민국 서울(AWS ap-northeast-2)", // 운영 프로젝트 Session pooler 호스트로 확인(2026-10-25)
  marketingConsent: null,
  overseasTransferReviewed: false,
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
  need(f.privacyOfficer, "개인정보 보호책임자")
  need(f.effectiveDate, "시행일")
  need(f.retention.subscribers, "보유 기간: 구독자")
  need(f.retention.members, "보유 기간: Insight Lab 회원")
  need(f.retention.feedback, "보유 기간: 피드백")
  need(f.retention.aiUsage, "보유 기간: AI 사용량 기록")
  need(f.disposalProcess, "보유 기간 경과 기록 파기 절차")
  need(f.databaseRegion, "데이터 저장 리전")
  need(f.marketingConsent, "광고성 정보 동의 필요 여부(법률 검토)")
  if (f.marketingConsent === "separate-consent") missing.push("광고성 정보 별도 동의 UI(미구현)")
  need(f.overseasTransferReviewed, "국외 이전 고지 법률 검토")
  return missing
}

export const privacyReady = (f: PrivacyFacts = PRIVACY_FACTS) => missingPrivacyFacts(f).length === 0
