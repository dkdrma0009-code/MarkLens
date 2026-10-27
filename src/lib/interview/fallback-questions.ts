// Questions that need no AI call: used when question generation fails or the daily AI budget is used up, so the
// interview can still start. Trend questions quote real published MarkLens headlines only; the rest is a fixed bank.
export interface FallbackQuestion { question: string; kind: "trend" | "role" | "behavioral" }

const ROLE_BANK: Record<string, string[]> = {
  "퍼포먼스 마케팅": [
    "광고 성과가 갑자기 떨어졌을 때 어떤 순서로 원인을 확인하시겠어요?",
    "전환율과 객단가 중 하나만 올릴 수 있다면 어느 쪽을 택하고, 그 이유는 무엇인가요?",
  ],
  "브랜드 마케팅": [
    "브랜드 인지도를 높였다는 것을 어떤 지표로 보여 주시겠어요?",
    "단기 매출 캠페인과 브랜드 일관성이 충돌할 때 어떻게 판단하시겠어요?",
  ],
  "콘텐츠 마케팅": [
    "같은 주제를 블로그·인스타그램·뉴스레터에 맞게 어떻게 다르게 만드시겠어요?",
    "조회수는 높은데 전환이 없는 콘텐츠가 있다면 무엇부터 바꾸시겠어요?",
  ],
  "CRM 마케팅": [
    "이탈 가능성이 높은 고객을 어떻게 찾고, 어떤 메시지를 보내시겠어요?",
    "푸시·이메일 발송 빈도를 정할 때 어떤 기준을 쓰시겠어요?",
  ],
}
const COMMON_ROLE = [
  "마케팅 예산이 절반으로 줄었다면 무엇을 남기고 무엇을 멈추시겠어요?",
  "최근 본 캠페인 중 하나를 골라 잘된 점과 아쉬운 점을 설명해 주세요.",
]
const BEHAVIORAL = [
  "계획대로 되지 않았던 프로젝트 경험과, 그때 어떻게 대응했는지 말씀해 주세요.",
  "다른 팀과 의견이 달랐을 때 어떻게 합의에 이르렀는지 사례로 설명해 주세요.",
  "숫자로 성과를 보여 준 경험이 있다면 상황·행동·결과 순서로 말씀해 주세요.",
]

/** `hooks` are published insight headlines (newest first). Order: trend, role, behavioral, repeated. */
export function fallbackQuestions(role: string, n: number, hooks: string[]): FallbackQuestion[] {
  const trend = hooks.map(h => h.trim()).filter(Boolean).slice(0, Math.ceil(n / 2))
    .map(h => ({ kind: "trend" as const, question: `최근 MarkLens에서 다룬 "${h}" 이야기를 ${role} 관점에서 어떻게 보시나요?` }))
  const roleQs = (ROLE_BANK[role] ?? COMMON_ROLE).map(q => ({ kind: "role" as const, question: q }))
  const behavioral = BEHAVIORAL.map(q => ({ kind: "behavioral" as const, question: q }))
  const rest: FallbackQuestion[] = []
  for (let i = 0; rest.length < Math.max(0, n - trend.length) && i < 10; i++) {
    if (roleQs[i]) rest.push(roleQs[i])
    if (rest.length < n - trend.length && behavioral[i]) rest.push(behavioral[i])
  }
  const all = [...trend, ...rest, ...COMMON_ROLE.map(q => ({ kind: "role" as const, question: q }))]
  return all.filter((q, i) => all.findIndex(x => x.question === q.question) === i).slice(0, n)
}
