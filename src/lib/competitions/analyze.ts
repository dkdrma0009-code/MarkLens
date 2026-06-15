import { geminiJson } from "@/lib/ai/gemini"

// 공모전·대외활동 LLM 분류 — 기존 lib/ai/analyze 패턴(geminiJson) 재사용.
const SYSTEM = `당신은 마케팅 취준·공모전 큐레이터다.
주어진 공모전/대외활동 정보를 분석해 아래를 JSON으로만 출력한다.

[출력]
{
  "title": "공모전명을 간결하게 정리 (원문 제목 과한 수식어·기관명 중복 제거, 60자 이내)",
  "description": "2~3문장 요약. 무엇을 하는 공모전이고 누가 지원하면 좋은지.",
  "category": "공모전|대외활동|서포터즈|기타 중 하나",
  "job_fit": ["콘텐츠기획","퍼포먼스","브랜드","데이터분석"] 중 해당되는 것 다중 선택 (배열),
  "difficulty": "하|중|상 (준비물·기간·전문성 기준)",
  "deadline": "YYYY-MM-DD 또는 null",
  "start_date": "YYYY-MM-DD 또는 null",
  "prize": "시상 규모 요약 또는 null",
  "eligibility": "지원 자격 요약 또는 null",
  "organizer": "주최/주관 기관명 또는 null"
}

[규칙]
- description과 title은 원문을 절대 그대로 복사하지 말 것. 사실만 확인해 자체 문장으로 재작성한다. (저작권·중복 콘텐츠 방지)
- 마케팅·광고 직무와의 연관성을 중심으로 본다.
- job_fit은 실제 직무 역량 기준. "이 공모전을 하면 어떤 직무 경험이 쌓이는가".
- 과장 없이 취준생 관점에서 실용적으로.
- 날짜는 본문에 명확히 있을 때만. 추측 금지, 불명확하면 null.
- JSON 외 텍스트 출력 금지.`

export interface CompetitionAnalysis {
  title: string
  description: string
  category: string
  job_fit: string[]
  difficulty: string
  deadline: string | null
  start_date: string | null
  prize: string | null
  eligibility: string | null
  organizer: string | null
}

export async function analyzeCompetition(input: {
  title: string
  content: string
  url: string
}): Promise<CompetitionAnalysis | null> {
  const prompt = `[수집 정보]
제목: ${input.title}
URL: ${input.url}
본문: ${input.content.slice(0, 4000)}

위 정보를 분석해 JSON으로만 출력하라.`
  return geminiJson<CompetitionAnalysis>(SYSTEM, prompt, 1500)
}
