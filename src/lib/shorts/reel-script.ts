import { generateText } from "@/lib/ai/llm"

/* 릴스 대본 생성 — 카드뉴스 슬라이드가 아니라 원본 인사이트에서 40~70초 대본을 짠다.
   슬라이드는 6장으로 압축된 결과물이라 정지 나열이 되고, 그게 벤치마킹 분석이
   지목한 실패 패턴이다. 원천(hook·summary·takeaways·framework)을 재료로 쓴다.

   벤치마킹 분석(scripts/output/benchmark-insights-*.md)에서 도출한 규칙을
   프롬프트에 그대로 박는다:
     - 길이 40~70초 (30초 미만은 참여율 최악 구간)
     - 첫 문장은 1인칭·호기심·가치제안 훅 (3인칭 정보제목 금지)
     - 선배 마케터 관점, 정보 나열 금지
     - 노골적 CTA 금지 (한국 시장에서 참여율 급락)
*/

// 한 비트 = 화면에 한 번에 뜨는 자막 덩어리 + 그 장면의 성격.
// role 로 배경 연출(줌·사진 톤)과 자막 스타일을 분기한다.
export type ReelBeat = {
  role: "hook" | "tension" | "insight" | "payoff" | "outro"
  text: string        // 화면 자막 (말하듯, 한 호흡)
  seconds: number     // 이 비트 길이 (읽는 속도 기준)
  emphasis?: string   // text 안에서 키워드 하나 (색 강조용, text 에 실제 포함돼야 함)
}

export type ReelScript = {
  beats: ReelBeat[]
  caption: string     // 인스타 캡션 (CTA·해시태그는 여기로 빼서 영상은 순수하게)
  totalSeconds: number
}

const SYSTEM =
  "너는 취준생·주니어 마케터 대상 한국어 마케팅 릴스 대본 작가다. " +
  "실제 성과 데이터에서 도출한 규칙을 반드시 지킨다:\n" +
  "1) 첫 비트(hook)는 1인칭이거나 호기심을 찌르는 질문/단언. 정보 요약·3인칭 제목 금지. " +
  "   나쁜 예: '리더십 변화, 무엇을 말하나'. 좋은 예: '나 주니어 때 이거 몰라서 개털렸다', " +
  "   '마케터 90%가 이 신호를 놓친다'.\n" +
  "2) 선배가 후배에게 말하듯. 정보 나열이 아니라 관점·경험·긴장을 담아라.\n" +
  "3) 영상 자체엔 '구독하세요/팔로우' 같은 노골적 CTA 금지 — 한국에선 그게 참여율을 죽인다. " +
  "   대신 마지막 비트(outro)는 여운이나 한 방 문장으로 닫는다. CTA 는 caption 으로만.\n" +
  "4) 각 비트 text 는 화면에 한 번에 뜰 한 호흡 길이(대략 15~45자). 말하듯 자연스럽게.\n" +
  "5) 전체 45~65초. beat 8~11개. 내용을 충분히 전개해라 — 30초 미만은 성과가 최악이다.\n" +
  "6) role 은 정확히 이 5개만 쓴다: hook, tension, insight, payoff, outro. 다른 값 금지. " +
  "   순서: hook 1개 → tension 1~2개 → insight 3~5개(핵심 전개) → payoff 1~2개 → outro 1개.\n" +
  "반드시 아래 JSON 만 출력. 설명·마크다운·다른 role 금지.\n" +
  '{"beats":[{"role":"hook","text":"자막","seconds":숫자,"emphasis":"키워드"}],' +
  '"caption":"인스타 캡션(후킹 한 줄 + 핵심 + 저장/팔로우 유도 + 해시태그 5개)"}'

export type InsightSource = {
  category: string
  hook?: string | null
  summary?: string | null
  keyTakeaways?: string[] | null
  frameworkAnalysis?: string | null
}

function buildPrompt(src: InsightSource): string {
  const parts = [`카테고리: ${src.category}`]
  if (src.hook) parts.push(`원본 훅: ${src.hook}`)
  if (src.summary) parts.push(`핵심 요약: ${src.summary}`)
  if (src.keyTakeaways?.length) parts.push(`핵심 인사이트:\n- ${src.keyTakeaways.join("\n- ")}`)
  if (src.frameworkAnalysis) parts.push(`프레임워크 분석: ${src.frameworkAnalysis.slice(0, 800)}`)
  return parts.join("\n\n") +
    "\n\n위 내용을 40~70초 릴스 대본으로. 정보를 나열하지 말고, 하나의 관점을 밀어붙여라."
}

// 읽는 속도로 비트 길이를 보정한다. LLM 이 준 seconds 는 신뢰하되, 한국어 릴스
// 자막 체감 속도(초당 약 5자 + 최소 노출 2.2초)로 하한을 건다. 촘촘하면 못 읽고
// 벤치마킹 데이터상 30초 미만이 참여율 최악 구간이라, 여유 있게 잡는다.
function fitSeconds(text: string, given: number): number {
  const byLen = Math.max(2.2, text.replace(/\s/g, "").length / 5 + 1.0)
  return Math.round(Math.max(given || 0, byLen) * 10) / 10
}

export async function generateReelScript(src: InsightSource): Promise<ReelScript> {
  const raw = await generateText({ system: SYSTEM, prompt: buildPrompt(src), maxTokens: 2000 })
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`대본 JSON 파싱 실패: ${raw.slice(0, 160)}`)
  const parsed = JSON.parse(m[0]) as { beats?: ReelBeat[]; caption?: string }
  if (!parsed.beats?.length) throw new Error("대본에 beats 가 없음")

  // 검증·보정: role 화이트리스트, 길이 재계산, emphasis 가 text 에 실제 포함되는지
  const roles = new Set(["hook", "tension", "insight", "payoff", "outro"])
  const beats: ReelBeat[] = parsed.beats.map(b => ({
    role: roles.has(b.role) ? b.role : "insight",
    text: (b.text ?? "").trim(),
    seconds: fitSeconds(b.text ?? "", b.seconds),
    emphasis: b.emphasis && b.text?.includes(b.emphasis) ? b.emphasis : undefined,
  })).filter(b => b.text)

  // 첫 비트는 반드시 hook — 벤치마킹의 핵심 규칙
  if (beats[0] && beats[0].role !== "hook") beats[0].role = "hook"

  const total = Math.round(beats.reduce((a, b) => a + b.seconds, 0) * 10) / 10
  return { beats, caption: (parsed.caption ?? "").trim(), totalSeconds: total }
}
