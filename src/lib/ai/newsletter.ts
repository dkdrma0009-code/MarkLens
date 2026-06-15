import { generateText } from "@/lib/ai/llm"

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens Weekly 수석 에디터입니다.
타깃은 마케팅 취준생·주니어 마케터. 목표는 읽고 나면 "이건 몰랐네 / 당장 써먹겠다"가 남는 뉴스레터입니다.

[톤]
- 뉴닉·Morning Brew 감성. 친근하지만 반말 금지. "~예요 / ~죠 / ~합니다" 경어체로 통일.
- 똑똑한 선배가 핵심만 콕 짚어주는 느낌. 점잖기만 하고 알맹이 없는 글이 최악입니다.

[반드시 지킬 것]
- 구체적 숫자·금액·규모·날짜를 본문에 넣는다 (제공된 자료에 있으면 반드시 인용). 자료에 없는 수치를 지어내지는 말 것.
- 실제 브랜드명·캠페인명·도구명·인물 직함을 쓴다.
- 각 섹션은 "그래서 당장 뭘 하라는 건지" 또는 "이게 왜 남다른지"가 분명해야 한다.
- MarkLens만의 뾰족한 관점 한 줄을 넣는다 — 남들 다 하는 요약 말고, 숨은 의미·역발상·반대 시각.

[절대 금지]
- 공허한 클로징: "함께 고민해보겠습니다", "주목해야 합니다", "중요합니다", "시사합니다", "~해야 할 때입니다", "발맞춰" 류 뜬구름 마무리.
- 추상적 일반론("통합적 사고가 필요하다" 같은 말). 반드시 구체적 행동으로 치환.
- 가상 수치·출처 없는 통계·창작 인물.
- 마크다운(**, *, #). 섹션 제목으로 문장 시작.

[섹션별 — 각 4~5문장]
week_signals: 이번 주 가장 큰 변화 1개를 숫자·고유명사와 함께. 왜 이게 신호인지 + 남들이 놓친 함의 한 줄.
case_of_week: [브랜드]가 구체적으로 뭘 했는지 → 실행 디테일(숫자·방식) → 왜 신선한지 → 주니어가 그대로 훔칠 수 있는 포인트 1개.
ai_brief: 오늘 30분 안에 끝내는 구체적 액션 1개를 단계로. (도구명 + 무엇을 입력/실행 → 어떤 결과물). "탐색해보세요" 같은 막연한 말 금지.
portfolio_insight: 이번 사례 하나를 STAR(상황·과제·행동·결과)로. 면접 답변 예시는 실제로 입에서 나올 수 있게 1~2문장 통째로.
career_lens: 이번 트렌드가 요구하는 역량 1개 + 지금 시작할 구체적 액션(특정 강의명·자격증·툴 이름).`

interface NewsletterInput {
  issueNumber: number
  insights: Array<{
    title: string
    summary: string
    category: string
    why_it_matters?: string
    practical_applications?: string
    key_takeaways?: string[]
  }>
}

interface NewsletterOutput {
  title: string
  intro: string
  week_signals: string
  case_of_week: string
  ai_brief: string
  portfolio_insight: string
  career_lens: string
}

export async function generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
  // 재료를 풍부하게 — 요약뿐 아니라 왜 중요/실전 적용/핵심 포인트까지 모두 전달해 깊이의 바닥을 올림
  const insightsSummary = input.insights
    .slice(0, 10)
    .map((i, idx) => {
      const parts = [`${idx + 1}. [${i.category}] ${i.title}`, `요약: ${i.summary}`]
      if (i.why_it_matters) parts.push(`왜 중요: ${i.why_it_matters}`)
      if (i.practical_applications) parts.push(`실전 적용: ${i.practical_applications}`)
      if (i.key_takeaways?.length) parts.push(`핵심 포인트: ${i.key_takeaways.join(" / ")}`)
      return parts.join("\n")
    })
    .join("\n\n")

  const text = await generateText({
    system: VOICE_SYSTEM_PROMPT,
    maxTokens: 5000,
    prompt: `MarkLens Weekly #${input.issueNumber}을 작성해주세요.

이번 주 인사이트:
${insightsSummary}

순수 JSON만 반환하세요. 각 섹션에 숫자·고유명사를 넣고, 공허한 마무리 없이 구체적 행동/관점으로 끝내세요:
{
  "title": "#${input.issueNumber} — [이번 주 핵심 키워드 3~5단어, 후킹되게]",
  "intro": "2~3문장. 경어체로 시작해 이번 호의 가장 흥미로운 한 가지를 먼저 던지는 오프닝. 뻔한 '다들 보셨나요'보다 구체적 사건으로.",
  "week_signals": "4~5문장. 이번 주 최대 변화 1개를 숫자·브랜드와 함께. 남들이 놓친 함의 한 줄로 마무리.",
  "case_of_week": "4~5문장. 실제 브랜드의 실행 디테일(숫자·방식). 주니어가 그대로 훔칠 포인트 1개로 마무리.",
  "ai_brief": "4~5문장. 오늘 30분 안에 끝내는 구체적 액션 1개를 단계로(도구명+입력+결과물). '탐색해보세요' 금지.",
  "portfolio_insight": "4~5문장. 사례 하나를 STAR로. 면접에서 통째로 말할 답변 1~2문장 포함.",
  "career_lens": "4~5문장. 요구 역량 1개 + 지금 시작할 구체적 액션(특정 강의·자격증·툴 이름)."
}`,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON found in response")

  // 1차: 제어문자 sanitize
  const raw = jsonMatch[0]
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
      if (c === " " || c === " ") { sanitized += "\\n"; continue }
      if (c.charCodeAt(0) < 0x20) continue
    }
    sanitized += c
  }

  // 2차: JSON.parse 시도, 실패 시 regex 폴백
  try {
    return JSON.parse(sanitized) as NewsletterOutput
  } catch {
    // 필드별 regex 추출 — 이스케이프된 문자 포함 처리
    function extractField(key: string): string {
      // (?:[^"\\]|\\.)*  → 따옴표/백슬래시 외 문자 or 이스케이프 시퀀스
      const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
      const m = sanitized.match(pattern)
      if (!m) return ""
      return m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim()
    }
    const result: NewsletterOutput = {
      title: extractField("title") || `#${input.issueNumber} — 이번 주 마케팅 인사이트`,
      intro: extractField("intro"),
      week_signals: extractField("week_signals"),
      case_of_week: extractField("case_of_week"),
      ai_brief: extractField("ai_brief"),
      portfolio_insight: extractField("portfolio_insight"),
      career_lens: extractField("career_lens"),
    }
    if (!result.week_signals && !result.case_of_week) {
      throw new Error("JSON parse failed and regex extraction found no content")
    }
    return result
  }
}
