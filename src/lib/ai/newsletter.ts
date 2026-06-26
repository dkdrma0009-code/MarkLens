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
- 각 body_section마다 image_keywords: 그 섹션 내용에 맞는 Unsplash 검색 영어 키워드 2~3개. 섹션마다 다르고 구체적으로(예: "influencer marketing agency", "brand strategy meeting"). 추상적 단어 금지(예: "marketing", "business").

[문장 리듬 — 가장 중요]
- 같은 어미를 3문장 연속 쓰지 않는다. "~입니다 / ~합니다 / ~있습니다 / ~됩니다"가 줄줄이 이어지면 글이 평평해진다. 평서문·질문·짧은 단문·체언 종결을 섞어 리듬을 만든다.
- 설명조("~을 보여주는 대표적인 사례입니다", "~라고 볼 수 있습니다")보다 단정형("액센츄어는 이미 한발 앞서 있다", "이건 광고가 아니라 인수다")으로 쓴다.
- 모든 문장을 길게 늘이지 않는다. 핵심 한 방은 짧게 끊어라. 긴 문장 뒤엔 짧은 문장.

[모범 톤 예시 — 이 펀치·구체성 수준으로 (다른 주제 예시, 내용 베끼지 말 것)]
intro 예: "이번 주, 구글이 조용히 검색의 규칙을 바꿨어요. 링크를 클릭하던 시대가 끝나간다는 신호인데요. 마케터에게 이건 'SEO를 더 잘하자'는 얘기가 아니라, 게임 자체가 바뀌었다는 경고예요."
body 예: "구글이 답을 직접 보여주기 시작했다. 사용자는 더 이상 사이트에 안 들어온다. 20년간 마케터가 쌓아온 '검색 순위'라는 자산이 하루아침에 흔들리는 거죠. 그럼 뭘 해야 할까요? 순위가 아니라 'AI가 인용하는 한 문장'을 설계해야 합니다."

[절대 금지]
- 공허한 마무리 어미: "~을 의미합니다 / 시사합니다 / 주목해야 합니다 / 고민해보겠습니다 / 보여주는 대표적인 사례입니다 / 고려해야 할 것입니다 / ~할 수 있습니다 / 필요가 있습니다". 같은 어미 반복 자체가 금지.
- 주어 없이 뜬구름 잡는 일반론("기업들은 ~해야 한다", "마케터라면 ~할 필요가 있다"). 항상 누가·무엇을 구체적으로.
- 마크다운(**, *, #).`

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

// Gemini가 부정 제약(금지 어미)을 약하게 따르므로, 생성 후 직접 검사해 위반이 많으면 1회 재생성한다.
// 모델·프롬프트는 그대로 두고 결정적으로 평평한 어미를 걸러내는 후처리 게이트.
const BANNED_ENDINGS = [
  "의미합니다", "시사합니다", "주목해야 합니다", "고민해보겠습니다",
  "대표적인 사례입니다", "고려해야 할 것입니다", "고려해야 합니다",
  "필요가 있습니다", "할 수 있습니다",
]
const RETRY_THRESHOLD = 2 // 금지 어미가 이 개수 이상이면 재생성

function collectProse(out: NewsletterOutput): string {
  return [
    out.intro,
    ...(out.body_sections ?? []).flatMap(s => s.paragraphs ?? []),
    out.for_your_career,
    ...(out.key_takeaways ?? []),
  ].filter(Boolean).join("\n")
}

// 발견된 금지 어미를 (중복 포함) 모두 반환 — 재생성 프롬프트에 그대로 인용한다.
function findBannedEndings(out: NewsletterOutput): string[] {
  const text = collectProse(out)
  return BANNED_ENDINGS.flatMap(p => {
    const n = text.split(p).length - 1
    return n > 0 ? Array(n).fill(p) : []
  })
}

// 생성 시 섹션마다 image_keywords를 받음 — 라우트가 이걸로 Unsplash 검색 후 visual을 채우고 키워드는 제거
type SectionOut = NewsletterBodySection & { image_keywords?: string[] }

interface NewsletterOutput {
  title: string
  intro: string
  topic_headline: string
  body_sections: SectionOut[]
  key_takeaways: string[]
  for_your_career: string
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
    { "subhead": "무슨 일이 일어났나", "paragraphs": ["...", "..."], "image_keywords": ["specific keyword", "..."] },
    { "subhead": "왜 중요한가", "paragraphs": ["..."], "image_keywords": ["다른 키워드", "..."] },
    { "subhead": "더 생각해볼 점", "paragraphs": ["..."], "image_keywords": ["또 다른 키워드", "..."] }
  ],
  "key_takeaways": ["핵심 인사이트 1", "2", "3"],
  "for_your_career": "3~4문장. 면접·포트폴리오 활용 + 한 줄 면접 답변 예시."
}`

  // 1차 생성. 금지 어미가 임계치 이상이면, 위반 문구를 콕 집어 1회만 재생성하고 더 깨끗한 쪽을 채택.
  const first = await generateOnce(prompt)
  const firstHits = findBannedEndings(first)
  if (firstHits.length < RETRY_THRESHOLD) return first

  const retryPrompt = `${prompt}

[재작성 지시] 직전 초안에서 아래 표현이 ${firstHits.length}번 반복돼 글이 평평했다. 이번엔 이 표현들을 단 한 번도 쓰지 말고, 매 문장 어미를 다르게 끝내라(단정형·질문·체언 종결 섞기):
- ${[...new Set(firstHits)].join("\n- ")}`

  const second = await generateOnce(retryPrompt).catch(() => null)
  if (!second) return first
  // 더 적게 위반한 쪽 채택 (재생성이 동률이면 새 버전 유지)
  return findBannedEndings(second).length <= firstHits.length ? second : first
}

// 1회 생성 + 구조 검증/정규화. 호출부의 lint·재생성 루프에서 재사용한다.
async function generateOnce(prompt: string): Promise<NewsletterOutput> {
  const data = await geminiJson<NewsletterOutput>(SYSTEM, prompt, 5000)
  if (!data?.topic_headline || !data?.body_sections?.length) {
    throw new Error("뉴스레터 생성 실패 (구조 불완전)")
  }
  // 방어: 배열 필드 정규화 (섹션별 image_keywords 보존 — 라우트가 사용)
  data.body_sections = data.body_sections
    .filter(s => s?.subhead && Array.isArray(s.paragraphs))
    .map(s => ({
      subhead: s.subhead,
      paragraphs: s.paragraphs.filter(Boolean),
      image_keywords: Array.isArray(s.image_keywords) ? s.image_keywords.filter(Boolean) : [],
    }))
  data.key_takeaways = Array.isArray(data.key_takeaways) ? data.key_takeaways.filter(Boolean) : []
  return data
}
