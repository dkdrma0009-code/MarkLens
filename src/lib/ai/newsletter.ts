import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly 에디터입니다. 뉴닉, Morning Brew처럼 짧고 재밌게 씁니다.

핵심 원칙:
- 독자는 바쁜 취준생/주니어 마케터. 3분 안에 읽혀야 함
- 인사이트 페이지 요약 절대 금지. 거기서 못 보는 '에디터의 관점'을 써야 함
- 각 섹션은 최대 3문장. 그 이상은 쓰지 마세요
- 문장은 짧게. 한 문장에 하나의 생각만
- "왜 내가 이걸 알아야 해?" 라는 질문에 바로 답하는 글을 씁니다
- 마지막에 "당신의 액션"이나 "한 줄 정리"로 마무리

절대 금지:
- **, *, #, 마크다운 문법
- "~입니다. ~합니다" 딱딱한 경어체 → "~해요, ~거예요" 부드러운 경어체
- 가상 수치 ("20% 증가" 등)
- 섹션 제목을 본문에 다시 쓰지 마세요 (예: "This Week's Signals —" 로 시작하는 문장 금지)`

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
  portfolio_insight: string
  career_lens: string
}

export async function generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
  const insightsSummary = input.insights
    .slice(0, 10)
    .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title}\n요약: ${i.summary}`)
    .join("\n\n")

  const text = await generateText({
    system: VOICE_SYSTEM_PROMPT,
    maxTokens: 5000,
    prompt: `MarkLens Weekly #${input.issueNumber}을 작성해주세요.

이번 주 수집된 인사이트:
${insightsSummary}

다음 JSON 형식으로 작성하세요. 마크다운 금지, 가상 수치 금지:
{
  "title": "이번 호 제목 (예: #12 — AI 검색이 바꾸는 마케팅의 미래). 반드시 #숫자 — 형식 유지",
  "week_signals": "이번 주 마케팅판에서 놓치면 안 되는 것 딱 하나. 2~3문장으로. '이게 왜 중요하냐면' 관점으로. 섹션 제목으로 시작하지 마세요.",
  "case_of_week": "이번 주 가장 흥미로운 캠페인/사례. 무슨 일인지 1문장 → 왜 신선한지 1문장 → 마케터로서 나라면? 1문장. 총 3문장. 섹션 제목으로 시작하지 마세요.",
  "ai_brief": "AI가 마케팅을 바꾸고 있는 것 중 지금 당장 써먹을 수 있는 것 1가지. 2문장. 도구 이름이나 구체적인 예시 포함. 섹션 제목으로 시작하지 마세요.",
  "portfolio_insight": "이번 주 인사이트를 포트폴리오에 녹이는 방법 1가지. '이렇게 써보세요' 형식으로 구체적으로. 2~3문장. STAR 금지, 가상 수치 금지. 섹션 제목으로 시작하지 마세요.",
  "career_lens": "취준생/주니어가 이번 주 트렌드로 지금 당장 할 수 있는 것 1가지. 추상적인 조언 말고 '오늘 XX를 해보세요' 수준으로 구체적으로. 2문장. 섹션 제목으로 시작하지 마세요."
}`,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  // Gemini가 JSON 문자열 값 안에 리터럴 개행 문자를 넣는 경우 수정
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
