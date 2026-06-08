import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly 수석 에디터입니다.
뉴닉, Morning Brew 감성. 친구한테 "야 이거 봤어?" 하는 톤으로.

핵심 원칙:
- 각 섹션 4~5문장. 읽을 거리가 있어야 함
- 구체적인 브랜드명, 캠페인명, 도구명 반드시 포함
- 추상적 표현 금지
- "~거예요, ~해요, ~죠" 부드러운 경어체
- 마크다운 (**, *, #) 절대 금지
- 가상 수치 / 출처 없는 통계 금지
- 인물 이름 창작 금지 (실제 확인된 브랜드만)
- 섹션 제목으로 문장 시작 금지

섹션 공식:
week_signals: 이번 주 마케팅 가장 큰 변화 → 왜 지금인지 → 어떤 브랜드/사례가 보여주는지 → 마케터에게 의미 → 액션 힌트 (4~5문장)
case_of_week: [실제 브랜드명]이 [뭘 했는지] → 어떻게 실행했는지 구체적으로 → 왜 신선한지 → 다른 브랜드와 뭐가 다른지 → 내가 배울 점 (4~5문장, 실제 브랜드명 필수)
ai_brief: 이번 주 트렌드 기반 오늘 30분 안에 할 수 있는 액션 → 구체적 방법 → 포트폴리오 활용법 → 왜 지금 이게 경쟁력인지 (4~5문장)`

interface NewsletterInput {
  issueNumber: number
  insights: Array<{
    title: string
    summary: string
    category: string
    why_it_matters?: string
    practical_applications?: string
  }>
}

interface NewsletterOutput {
  title: string
  week_signals: string
  case_of_week: string
  ai_brief: string
}

export async function generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
  const insightsSummary = input.insights
    .slice(0, 10)
    .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title}\n요약: ${i.summary}${i.why_it_matters ? `\n왜 중요: ${i.why_it_matters}` : ""}`)
    .join("\n\n")

  const text = await generateText({
    system: VOICE_SYSTEM_PROMPT,
    maxTokens: 5000,
    prompt: `MarkLens Weekly #${input.issueNumber}을 작성해주세요.

이번 주 인사이트:
${insightsSummary}

순수 JSON만 반환하세요:
{
  "title": "#${input.issueNumber} — [이번 주 핵심 키워드 3~5단어]",
  "week_signals": "4~5문장. 이번 주 마케팅 최대 변화. 브랜드/사례 구체적으로.",
  "case_of_week": "4~5문장. 실제 브랜드명 필수. 가장 흥미로운 캠페인 상세 분석.",
  "ai_brief": "4~5문장. 오늘 30분 안에 할 수 있는 구체적 액션 + 포트폴리오 활용법."
}`,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  let raw = jsonMatch[0]
  let sanitized = ""
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (escaped) { sanitized += c; escaped = false; continue }
    if (c === "\\") { sanitized += c; escaped = true; continue }
    if (c === '"') { inString = !inString; sanitized += c; continue }
    if (inString) {
      if (c === "\n") { sanitized += "\\n"; continue }
      if (c === "\r") { sanitized += "\\r"; continue }
      if (c === "\t") { sanitized += "\\t"; continue }
      if (c.charCodeAt(0) < 0x20) continue
    }
    sanitized += c
  }

  return JSON.parse(sanitized) as NewsletterOutput
}
