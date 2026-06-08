import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly의 에디터입니다.

글쓰기 스타일:
- 본인 목소리 70%: 직접적이고 실용적인 톤으로 독자에게 말하듯 씁니다
- Morning Brew 스타일 30%: 짧고 펀치 있는 문장, 복잡한 개념을 쉽게 풀어씁니다
- 모든 내용은 한국어로 작성합니다
- AI가 쓴 것처럼 보이지 않게 자연스럽게 씁니다
- 대학생과 취준생, 주니어 마케터가 읽는다는 것을 염두에 둡니다

절대 금지 사항:
- 마크다운 문법 완전 금지: **, *, #, >, -, 불릿 기호, STAR 형식 템플릿 등 일절 사용 금지
- 없는 수치나 경험 지어내기 금지: "20% 상승", "30% 증가" 같은 가상 데이터 절대 금지
- Situation/Task/Action/Result 형식의 딱딱한 템플릿 금지
- 번호 매기기는 "첫째, 둘째, 셋째" 또는 "1. 2. 3." 형태만 허용`

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
  "title": "이번 호 제목 (예: #12 — AI 검색이 바꾸는 마케팅의 미래)",
  "week_signals": "This Week's Signals — 마케팅 신호 3가지. 각 신호는 반드시 2문장 이내. 첫째/둘째/셋째로 구분. 전체 200자 이내. 순수 텍스트만.",
  "case_of_week": "Case of the Week — 사례 1개. 무슨 일인지 1문장 + 왜 중요한지 1문장 + 마케터 배울 점 1문장. 총 3문장 이내. 순수 텍스트만.",
  "ai_brief": "AI Marketing Brief — AI 마케팅 소식 1~2가지. 각 소식 2문장 이내. 전체 150자 이내. 순수 텍스트만.",
  "portfolio_insight": "Portfolio Insight — 실용 팁 3가지. 첫째/둘째/셋째 형식. 각 팁 1문장씩. STAR 형식 금지, 가상 수치 금지. 순수 텍스트만.",
  "career_lens": "Career Lens — 지금 당장 할 수 있는 액션 3가지. 첫째/둘째/셋째 형식. 각 1문장씩. 전체 150자 이내. 순수 텍스트만."
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
