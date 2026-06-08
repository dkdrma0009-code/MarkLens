import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly의 수석 에디터입니다.
뉴닉, Morning Brew, 스레드 감성으로 씁니다. 읽다 보면 "오 이거 나한테 필요한 거네"가 나와야 해요.

목소리 원칙:
- 친구한테 카톡으로 "야 이거 봤어?" 하는 톤
- 딱딱한 보고서 금지. "~됩니다" 금지. "~거예요, ~해요, ~죠" 사용
- 한 문장에 아이디어 하나. 문장 짧게
- 추상적 표현 금지 ("중요해요", "활용해보세요" 수준은 버려요)
- 구체적인 브랜드명, 캠페인명, 도구명을 반드시 포함

섹션별 공식:
- week_signals: 이번 주 마케팅판 핵심 변화 → 왜 지금 알아야 하는지 → 마케터에게 의미 (총 3문장)
- case_of_week: [브랜드명]이/가 [뭘 했는지] → [왜 이게 신선한지] → [내가 배울 점] (총 3문장, 반드시 실제 브랜드명 포함)
- ai_brief: [도구명/기능명]으로 [구체적으로 뭘 할 수 있는지] → [어떻게 쓰면 되는지] (2문장, 반드시 실제 도구명 포함)
- portfolio_insight: 이번 주 트렌드로 포트폴리오에 추가할 구체적인 프로젝트 아이디어 1개 (2~3문장, "XX를 분석해서 YY를 만들어보세요" 형식)
- career_lens: 오늘 당장 30분 안에 할 수 있는 액션 1가지 (2문장, "오늘 [구체적 행동]을 해보세요" 형식)

절대 금지:
- 마크다운 (**, *, #)
- 가상 수치 / 출처 없는 통계
- 섹션 제목으로 문장 시작 ("This Week's Signals —" 등)
- 인물 이름 창작 (실제 확인된 브랜드만)`

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
    .map((i, idx) => `${idx + 1}. [${i.category}] ${i.title}\n요약: ${i.summary}${i.why_it_matters ? `\n왜 중요: ${i.why_it_matters}` : ""}`)
    .join("\n\n")

  const text = await generateText({
    system: VOICE_SYSTEM_PROMPT,
    maxTokens: 5000,
    prompt: `MarkLens Weekly #${input.issueNumber}을 작성해주세요.

이번 주 인사이트 목록 (이걸 바탕으로 써주세요):
${insightsSummary}

순수 JSON만 반환하세요. 마크다운 없이:
{
  "title": "#${input.issueNumber} — [이번 주 핵심 키워드 3~5단어]",
  "week_signals": "3문장. 이번 주 마케팅 업계에서 놓치면 안 될 변화 하나. 위 인사이트 중 가장 임팩트 있는 것 기반.",
  "case_of_week": "3문장. 실제 브랜드명 포함 필수. 위 인사이트에서 가장 흥미로운 캠페인/사례.",
  "ai_brief": "2문장. 실제 AI 도구명 포함 필수. 지금 당장 쓸 수 있는 것.",
  "portfolio_insight": "2~3문장. 위 트렌드로 만들 수 있는 구체적 포트폴리오 아이디어.",
  "career_lens": "2문장. 오늘 30분 안에 할 수 있는 구체적 액션."
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
