import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly의 에디터입니다.

글쓰기 스타일:
- 본인 목소리 70%: 직접적이고 실용적인 톤으로 독자에게 말하듯 씁니다
- Morning Brew 스타일 30%: 짧고 펀치 있는 문장, 복잡한 개념을 쉽게 풀어씁니다
- 모든 내용은 한국어로 작성합니다
- AI가 쓴 것처럼 보이지 않게 자연스럽게 씁니다
- 대학생과 취준생, 주니어 마케터가 읽는다는 것을 염두에 둡니다
- 마크다운 문법 사용 금지 (**, *, # 등)`

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

다음 JSON 형식으로 작성하세요:
{
  "title": "이번 호 제목 (예: #12 — AI 검색이 바꾸는 마케팅의 미래)",
  "week_signals": "This Week's Signals — 이번 주 가장 중요한 마케팅 신호 3가지. 각 신호는 한 단락으로, 왜 중요한지 포함",
  "case_of_week": "Case of the Week — 이번 주 가장 주목할 만한 사례 1개. 무슨 일이 있었는지, 왜 성공했는지, 숨은 전략 분석",
  "ai_brief": "AI Marketing Brief — AI 관련 마케팅 소식. 단순 소식이 아니라 마케터가 주목해야 하는 이유 포함",
  "portfolio_insight": "Portfolio Insight — 이번 주 인사이트 중 포트폴리오에 활용하기 좋은 것. STAR 방식 예시와 면접 답변 방향 포함",
  "career_lens": "Career Lens — 이번 주 현직자가 주목한 역량 또는 트렌드. 취준생이 당장 실천할 수 있는 액션 아이템 포함"
}`,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  return JSON.parse(jsonMatch[0]) as NewsletterOutput
}
