import { geminiJson } from "@/lib/ai/gemini"
import type { NewsletterBodySection } from "@/types"

// "한 주제 깊이형" 뉴스레터 — 여러 주제 얕게 나열 대신, 이번 주 가장 강한 단 하나를 깊게.
const SYSTEM = `당신은 MarkLens Weekly 수석 에디터입니다.
타깃은 마케팅 취준생·주니어 마케터. Morning Brew·SOSIC처럼 한 주제를 깊게 파고, 짧고 펀치 있게 씁니다.

[이번 호 원칙]
- 주어진 인사이트 중 가장 강한 단 하나(캠페인 또는 트렌드)를 골라 깊게 분석한다. 여러 주제를 나열하지 않는다.
- 본문 구조: 무슨 일이 일어났나 → 맥락·배경 → 왜 중요한가(마케터 관점) → 더 생각해볼 점.
- 독자에게 말 걸듯 친근한 경어체("~예요/~죠/~합니다"). 반말 금지.

[반드시]
- 구체적 숫자·고유명사·브랜드명을 본문에 넣는다(자료에 있으면). 없는 수치는 지어내지 말 것.
- title은 후킹형 한 줄: 궁금증·의외성·위기감·숫자 중 하나. 주제 나열형 제목 금지.
- topic_headline은 이번 주제를 한 문장으로 압축한 명제(인용구 박스에 들어감).
- for_your_career는 짧게 응축: 이 주제를 면접·포트폴리오에 어떻게 쓰는지 + 한 줄 면접 답변. 3~4문장 이내.
- source_index: 위 인사이트 목록에서 이번 호 주제로 고른 항목의 번호(1부터).
- image_query: 이번 주제를 대표하는 사진 검색용 영어 키워드 2~4단어(브랜드/제품/상황). 예: "coca cola summer billboard".

[절대 금지]
- "~을 의미합니다 / 시사합니다 / 주목해야 합니다 / 고민해보겠습니다" 류 공허한 마무리.
- 추상적 일반론. 마크다운(**, *, #).`

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
  topic_headline: string
  body_sections: NewsletterBodySection[]   // 생성 시엔 visual 없음 — 라우트가 비주얼을 채움
  key_takeaways: string[]
  for_your_career: string
  source_index: number   // 본문 비주얼용 — 고른 주제 인사이트 번호(1부터)
  image_query: string    // 본문 비주얼용 — Unsplash 검색 영어 키워드
}

export async function generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
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

  const prompt = `MarkLens Weekly #${input.issueNumber}을 작성합니다.

이번 주 인사이트(이 중 가장 강한 단 하나를 골라 깊게):
${insightsSummary}

아래 JSON 스키마로만 출력하세요. 한 주제를 깊게, 공허한 마무리 없이:
{
  "title": "#${input.issueNumber} — 후킹형 한 줄 (궁금증·의외성·숫자)",
  "intro": "2~3문장. 경어체 인사 + 이번 호가 다룰 한 주제를 흥미롭게 예고.",
  "topic_headline": "이번 주제를 한 문장으로 압축한 명제.",
  "body_sections": [
    { "subhead": "무슨 일이 일어났나", "paragraphs": ["...", "..."] },
    { "subhead": "왜 중요한가", "paragraphs": ["..."] },
    { "subhead": "더 생각해볼 점", "paragraphs": ["..."] }
  ],
  "key_takeaways": ["핵심 인사이트 1", "2", "3"],
  "for_your_career": "3~4문장. 면접·포트폴리오 활용 + 한 줄 면접 답변 예시.",
  "source_index": 1,
  "image_query": "english keywords for a representative photo"
}`

  const data = await geminiJson<NewsletterOutput>(SYSTEM, prompt, 5000)
  if (!data?.topic_headline || !data?.body_sections?.length) {
    throw new Error("뉴스레터 생성 실패 (구조 불완전)")
  }
  // 방어: 배열 필드 정규화
  data.body_sections = data.body_sections
    .filter(s => s?.subhead && Array.isArray(s.paragraphs))
    .map(s => ({ subhead: s.subhead, paragraphs: s.paragraphs.filter(Boolean) }))
  data.key_takeaways = Array.isArray(data.key_takeaways) ? data.key_takeaways.filter(Boolean) : []
  data.source_index = Number.isInteger(data.source_index) && data.source_index > 0 ? data.source_index : 1
  data.image_query = typeof data.image_query === "string" ? data.image_query : ""
  return data
}
