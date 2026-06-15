import { geminiJson } from "@/lib/ai/gemini"
import { validateCardnews } from "@/lib/cardnews/validate"
import type { Cardnews } from "@/lib/cardnews/types"

// 용어·꿀팁 카드뉴스 생성 — 입력이 기사가 아니라 '용어/개념'. 출력 구조는 기사 카드뉴스와 동일(6장).
const TERM_SYSTEM = `당신은 마케팅 미디어 'MarkLens'의 카드뉴스 에디터다.
마케팅 취준생·주니어가 알아야 할 '용어·개념'을 인스타 카드뉴스 6장으로 쉽게 설명한다.

[전략]
- 타겟은 마케팅 취준생. "이거 외워둬야지" 하고 저장하게 만드는 게 목표다.
- 어려운 용어를 쉬운 비유로. 교과서 정의 복붙 금지.

[카피 규칙]
- cover.headline (첫 장 후킹이 생명): 줄당 최대 12자, 2~3줄. 궁금증·결핍 자극형으로.
  예: "DR이 / 뭐예요?", "퍼포먼스 vs / 브랜드?", "이거 모르면 / 면접서 막힘". 정보 나열 금지.
- cover.highlight: 헤드라인에 실제 포함된 단어 1개.
- cover.sub: 최대 18자.
- fact.body: 용어의 핵심 정의를 쉽게. 2~3문장, 90자 이내. 비유 환영.
- why.headline: 최대 16자. 왜 알아야 하는지.
- why.body: 취준생 입장에서 왜 중요한지. 90자 이내.
- apply.body: 면접·실무에서 바로 쓰는 한 문장. 80자 이내. 저장 유발 실전 팁.
- keywords: 관련 용어 2~3개. word 12자, desc 22자.
- cta.headline: 면접/공부 연결. cta.body: 풀버전 사이트 유도.
- 전체 톤: 간결한 경어체("~합니다/~예요"). 이모지 금지.

[글자수 엄수] 제한을 1자라도 넘기면 디자인이 깨진다. 제한 90% 이내 목표로 짧게.
[출력] 지정 JSON 스키마로만. JSON 외 텍스트 금지.`

const SCHEMA_HINT = `{
  "category": "용어/꿀팁",
  "slides": [
    { "type": "cover", "headline": ["줄1", "줄2"], "highlight": "단어", "sub": "서브 한 줄" },
    { "type": "fact", "body": "용어 정의 (쉽게)" },
    { "type": "why", "headline": "왜 중요", "body": "..." },
    { "type": "apply", "body": "면접·실무 활용 한 문장" },
    { "type": "keywords", "keywords": [{ "word": "관련용어", "desc": "설명" }] },
    { "type": "cta", "headline": "면접에서 써먹는 마케팅 기본기", "body": "더 많은 용어는 프로필 링크에서" }
  ]
}`

export async function generateTermCard(term: string): Promise<{ data: Cardnews | null; warnings: string[] }> {
  const prompt = `용어/개념: ${term}

위 용어를 마케팅 취준생 눈높이로 카드뉴스 6장으로 만들어라. 아래 스키마로만 출력:
${SCHEMA_HINT}`

  const data = await geminiJson<Cardnews>(TERM_SYSTEM, prompt, 2500)
  if (!data?.slides?.length) return { data: null, warnings: ["생성 실패"] }

  // 용어카드는 기사 이미지가 없으므로 표지를 타이포로 고정
  const cover = data.slides[0]
  if (cover?.type === "cover") cover.usePhoto = false
  if (!data.category) data.category = "용어/꿀팁"

  return { data, warnings: validateCardnews(data) }
}
