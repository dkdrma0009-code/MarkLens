import { slugify } from "@/lib/utils"
import { generateText } from "@/lib/ai/llm"

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

export async function generateQuiz(content: string): Promise<object | null> {
  if (!GEMINI_KEY || content.length < 100) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `너는 마케팅 교육 전문가야. 주어진 글을 읽고 핵심 내용을 테스트하는 4지선다 퀴즈 1문제를 만들어줘. 반드시 아래 JSON 형식으로만 응답해. 설명이나 마크다운 없이 JSON만.\n{"questions":[{"question":"문제","options":["① 보기1","② 보기2","③ 보기3","④ 보기4"],"answer":0,"explanation":"해설"}]}\nanswer는 정답 인덱스(0~3).` }] },
          contents: [{ parts: [{ text: content.slice(0, 2000) }] }],
        }),
      }
    )
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

const CATEGORIES = [
  "branding", "performance-marketing", "crm", "content-marketing",
  "seo", "social-media", "ai-marketing", "consumer-psychology",
]

const CATEGORY_LABELS: Record<string, string> = {
  "branding": "브랜딩",
  "performance-marketing": "퍼포먼스 마케팅",
  "crm": "CRM",
  "content-marketing": "콘텐츠 마케팅",
  "seo": "SEO",
  "social-media": "소셜 미디어",
  "ai-marketing": "AI 마케팅",
  "consumer-psychology": "소비자 심리",
}

const VOICE_SYSTEM_PROMPT = `당신은 MarkLens의 에디터입니다.

글쓰기 스타일 지침:
- 본인 목소리 70%: 직접적이고 실용적인 톤. "이 사례에서 배울 수 있는 것은..." 같은 방식으로 독자에게 직접 말하듯 씁니다.
- Morning Brew 스타일 30%: 짧고 펀치 있는 문장. 복잡한 개념을 쉽게 풀어씁니다.

규칙:
- 모든 분석은 한국어로 작성합니다
- "이 글은", "본 아티클은" 같은 딱딱한 표현을 피합니다
- 실무에 즉시 활용 가능한 내용을 중심으로 씁니다
- 단순 요약이 아닌 "왜"와 "어떻게"에 집중합니다
- **절대로 마크다운 문법을 사용하지 않습니다**: **, *, #, >, - 등 일절 금지. 순수 텍스트만 씁니다.

문장 톤 (AI 티 제거 — 가장 중요):
- 같은 어미를 3문장 연속 쓰지 않습니다. "~입니다 / ~합니다 / ~있습니다 / ~됩니다"가 줄줄이 이어지면 즉시 다른 종결로 바꿉니다(단문·질문·체언 종결 섞기).
- 설명조 마무리를 금지합니다: "~을 보여주는 대표적인 사례입니다", "~라고 볼 수 있습니다", "~할 수 있습니다", "고려해야 할 것입니다", "필요가 있습니다". 대신 단정형으로 씁니다("액센츄어는 이미 한발 앞서 있다").
- 주어 없는 일반론("기업들은 ~해야 한다") 대신 누가·무엇을 구체적으로 짚습니다.
- 긴 문장 뒤엔 짧은 문장. 핵심 한 방은 짧게 끊습니다.

대조 예시 (왼쪽처럼 쓰지 말고, 항상 오른쪽처럼):
- "인플루언서 마케팅이 중요해지고 있다" → "광고는 끝났다. 이제 브랜드는 사람을 빌린다"
- "이 인수는 시장 성장을 보여주는 대표적인 사례입니다" → "컨설팅 회사가 광고대행사를 샀다. 전략과 실행의 경계가 무너진 신호다"
- "다양한 채널을 활용하는 것을 고려해볼 수 있습니다" → "채널부터 늘리지 마라. 한 채널에서 '왜 통했는지'부터 분해하라"

꺾기 원칙 (인사이트의 핵심):
- '문제→뻔한 해결'의 직선을 한 번 비틉니다. 탐색이 피곤하다→추천 강화, 인지도가 낮다→광고 확대 같은 1차원 결론은 금지.
- 문제를 더 잘 푸는 대신, 문제가 생기는 '상황·판' 자체를 옮기는 관점을 찾습니다. "누구나 떠올릴 답"이면 다시 씁니다.`

interface ArticleInput {
  title: string
  content: string
  url: string
}

interface InsightOutput {
  slug: string
  hook: string
  summary: string
  video_url?: string | null
  marketing_terms?: { term: string; definition: string }[] | null
  key_takeaways: string[]
  why_it_matters: string
  practical_applications: string
  framework_analysis: string
  portfolio_usage: string
  interview_points: string[]
  category: string
  tags: string[]
  keywords: string[]
  quiz?: object | null
}

type NarrativeDraft = {
  hook: string
  summary: string
  key_takeaways: string[]
  why_it_matters: string
  practical_applications: string
  interview_points: string[]
}

// 자기비판·개선 패스(reflexion) — 초안 분석을 편집장 관점으로 다듬는다.
// 배치(cron) 분석에서만 돌아 사용자 대기에 영향 없음. 실패·불완전 시 원본 유지.
async function refineAnalysis(article: ArticleInput, draft: NarrativeDraft): Promise<Partial<NarrativeDraft> | null> {
  if (!draft.hook && !draft.why_it_matters) return null // 빈 초안은 다듬을 게 없음 (webhook이 reject)

  const system = `당신은 MarkLens의 편집장입니다. 후배가 쓴 초안 분석을 더 날카롭게 다듬습니다.

다듬는 기준:
- 직선 차단: '문제→뻔한 해결'의 1차원 논리를 한 번 꺾어 '판을 옮기는' 통찰로 (예: 탐색이 피곤하다→추천강화 같은 직선 결론 금지).
- 진부함 제거: "누구나 떠올릴 답"을 독창적 관점으로, 일반론을 구체적 주장으로.
- 액션 구체화: 실전 적용을 모호한 조언 대신 바로 실행 가능한 단계로.
- 문장 리듬: 같은 어미 반복·AI투("~을 의미합니다/시사합니다/할 수 있습니다") 제거, 단정형 섞기.
- 사실 보존: 초안의 사실·고유명사·수치를 바꾸거나 새로 지어내지 말 것. 없는 통계 금지.
- 마크다운 금지, 한국어. 이미 충분히 좋은 부분은 그대로 두고 약한 부분만 고친다.`

  const prompt = `[원문 제목] ${article.title}
[원문 일부] ${article.content.slice(0, 1500)}

[초안 분석]
${JSON.stringify({
    hook: draft.hook,
    summary: draft.summary,
    key_takeaways: draft.key_takeaways,
    why_it_matters: draft.why_it_matters,
    practical_applications: draft.practical_applications,
    interview_points: draft.interview_points,
  }, null, 1)}

위 초안을 기준에 따라 다듬어 동일한 JSON 스키마로만 출력하세요. JSON 외 텍스트 금지.`

  try {
    const text = await generateText({ system, prompt, maxTokens: 3000 })
    const m = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").match(/\{[\s\S]*\}/)
    if (!m) return null
    const p = JSON.parse(m[0])
    const out: Partial<NarrativeDraft> = {}
    if (typeof p.hook === "string" && p.hook.trim()) out.hook = p.hook.trim()
    if (typeof p.summary === "string" && p.summary.trim()) out.summary = p.summary
    if (Array.isArray(p.key_takeaways) && p.key_takeaways.length) out.key_takeaways = p.key_takeaways.map(String)
    if (typeof p.why_it_matters === "string" && p.why_it_matters.trim()) out.why_it_matters = p.why_it_matters
    if (typeof p.practical_applications === "string" && p.practical_applications.trim()) out.practical_applications = p.practical_applications
    if (Array.isArray(p.interview_points) && p.interview_points.length) out.interview_points = p.interview_points.map(String)
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

export async function analyzeArticle(article: ArticleInput): Promise<InsightOutput> {
  // 분류 + 분석을 1번 호출로 통합 — AI 호출 횟수 절반으로 감소
  const combinedText = await generateText({
    system: VOICE_SYSTEM_PROMPT,
    prompt: `다음 마케팅 아티클을 분석해서 JSON 형식으로 응답해주세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.

아티클 제목: ${article.title}
아티클 내용:
${article.content.substring(0, 3000)}

카테고리 목록: ${CATEGORIES.join(", ")}

[품질 기준 — 이 날카로움·구체성 수준으로 쓰세요 (다른 주제의 예시일 뿐, 내용 베끼지 말 것)]
hook 예: "검색은 죽지 않았다. 검색창이 사라졌을 뿐"
why_it_matters 예: "구글이 답을 직접 내놓기 시작하면서 '링크 클릭'이라는 20년 된 게임의 규칙이 바뀌었다. 트래픽을 나눠 갖던 시대는 끝났다. 이제 싸움은 순위가 아니라 'AI 답변 안에 인용되느냐'다. SEO 담당자가 관리할 지표 자체가 바뀐 것이다."
practical_applications 예: "첫째, 콘텐츠를 질문-답변 구조로 다시 짠다. 둘째, 한 문단 첫 줄에 결론을 박는다 — AI는 두괄식을 인용한다. 셋째, 통계·정의·단계처럼 '떼어 인용하기 좋은' 블록을 의도적으로 심는다."

다음 JSON 구조로 응답하세요:
{
  "category": "${CATEGORIES[0]} 중 하나",
  "tags": ["태그1", "태그2", "태그3"],
  "keywords": ["키워드1", "키워드2"],
  "hook": "독자를 낚는 한 줄 후킹 멘트 (20-35자, 질문형 또는 반전형, 예: 'SEO가 죽어가고 있다. 그 자리를 차지할 건 누구?')",
  "summary": "핵심 요약 (2-3문장, 자연스럽게)",
  "key_takeaways": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "why_it_matters": "왜 중요한가 (마케터 관점에서, 2-3단락)",
  "practical_applications": "실전 적용법 (구체적인 액션 아이템 포함, 2-3단락)",
  "framework_analysis": "활용된 마케팅 프레임워크 분석",
  "interview_points": ["면접에서 그대로 말할 수 있는 완성형 한 마디 (1~2문장). 이 아티클의 트렌드나 사례를 인용하며 자기 생각으로 마무리. 예시 형식: '최근 ◯◯가 ~하는 걸 보면서 ~라고 느꼈습니다. 저라면 ~하겠습니다.' 가짜 수치 금지, 과제 지시 금지", "두 번째 한 마디 — 첫 번째와 다른 각도(소비자/브랜드/데이터 중 하나)에서"],
  "marketing_terms": [{"term": "아티클에 실제 등장하는 영어 약어/전문 개념어", "definition": "아티클 맥락 + 마케팅 의미 2문장"}]
}`,
    maxTokens: 4000,
  })

  let parsed: Record<string, unknown> = {}
  try {
    const jsonMatch = combinedText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch?.[0] ?? "{}")
  } catch {
    // JSON 파싱 실패 시 빈 객체로 진행 (거절 기준은 webhook에서 판단)
  }

  const rawCategory = String(parsed.category ?? "")
  const classification = {
    category: CATEGORIES.includes(rawCategory) ? rawCategory : CATEGORIES[0],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  }

  const analysis = {
    hook: String(parsed.hook ?? ""),
    summary: String(parsed.summary ?? ""),
    key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
    why_it_matters: String(parsed.why_it_matters ?? ""),
    practical_applications: String(parsed.practical_applications ?? ""),
    framework_analysis: String(parsed.framework_analysis ?? ""),
    // portfolio_usage는 과제형 출력이라 폐기 — 면접 한 마디(interview_points)로 통합 (DB 컬럼 호환 위해 빈 값 유지)
    portfolio_usage: "",
    interview_points: Array.isArray(parsed.interview_points) ? parsed.interview_points : [],
    marketing_terms: Array.isArray(parsed.marketing_terms) ? parsed.marketing_terms : [],
  }

  // 자기비판·개선 패스 (배치 전용 — 사용자 대기 영향 없음). 개선분이 슬러그·퀴즈에도 반영되게 먼저 실행.
  const refined = await refineAnalysis(article, analysis)
  if (refined) Object.assign(analysis, refined)

  const quizContent = [analysis.why_it_matters, analysis.practical_applications, analysis.summary]
    .filter(Boolean).join("\n\n")
  const [videoUrl, quiz] = await Promise.all([
    findYouTubeVideo(article.title),
    generateQuiz(quizContent),
  ])

  return {
    // 한국어 hook 기반 슬러그 (한국어 검색 정렬), hook 없으면 원문 제목
    slug: slugify(analysis.hook) || slugify(article.title),
    category: CATEGORY_LABELS[classification.category] ?? classification.category,
    tags: classification.tags ?? [],
    keywords: classification.keywords ?? [],
    video_url: videoUrl,
    quiz,
    ...stripMarkdown(analysis),
  }
}

async function findYouTubeVideo(title: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  // 검색 쿼리: 제목 키워드 + marketing
  const query = encodeURIComponent(`${title} marketing`)

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=3&relevanceLanguage=en&videoDuration=medium&key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null

    const data = await res.json()
    const videoId = data.items?.[0]?.id?.videoId
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
  } catch {
    return null
  }
}

function stripMarkdown<T extends Record<string, unknown>>(obj: T): T {
  const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s/gm, "").replace(/^>\s/gm, "")
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") result[k] = clean(v)
    else if (Array.isArray(v)) result[k] = v.map((i) => typeof i === "string" ? clean(i) : i)
    else result[k] = v
  }
  return result as unknown as T
}
