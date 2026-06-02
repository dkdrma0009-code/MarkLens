import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { slugify } from "@/lib/utils"

function getClaudeClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
- AI가 쓴 것처럼 보이지 않게 자연스럽게 씁니다
- "이 글은", "본 아티클은" 같은 딱딱한 표현을 피합니다
- 실무에 즉시 활용 가능한 내용을 중심으로 씁니다
- 단순 요약이 아닌 "왜"와 "어떻게"에 집중합니다
- **절대로 마크다운 문법을 사용하지 않습니다**: **, *, #, >, - 등 일절 금지. 순수 텍스트만 씁니다.`

interface ArticleInput {
  title: string
  content: string
  url: string
}

interface InsightOutput {
  slug: string
  hook: string
  summary: string
  key_takeaways: string[]
  why_it_matters: string
  practical_applications: string
  framework_analysis: string
  portfolio_usage: string
  interview_points: string[]
  category: string
  tags: string[]
  keywords: string[]
}

export async function analyzeArticle(article: ArticleInput): Promise<InsightOutput> {
  const claude = getClaudeClient()
  const openai = getOpenAIClient()

  // GPT-4o: 카테고리 분류 + 태그 + 키워드 추출 (실패 시 Claude 폴백)
  let classification: { category: string; tags: string[]; keywords: string[] }
  try {
    const classificationRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `다음 마케팅 아티클을 분류합니다. 반드시 JSON 형식으로만 응답하세요.
카테고리 목록: ${CATEGORIES.join(", ")}`,
        },
        {
          role: "user",
          content: `제목: ${article.title}\n\n내용 요약: ${article.content.substring(0, 500)}`,
        },
      ],
      response_format: { type: "json_object" },
    })
    const parsed = JSON.parse(classificationRes.choices[0].message.content ?? "{}")
    classification = {
      category: CATEGORIES.includes(parsed.category) ? parsed.category : CATEGORIES[0],
      tags: parsed.tags ?? [],
      keywords: parsed.keywords ?? [],
    }
  } catch {
    // GPT-4o 실패 시 Claude로 분류
    const fallbackRes = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `다음 마케팅 아티클을 분류하세요. JSON만 반환하세요.
카테고리 목록: ${CATEGORIES.join(", ")}
형식: {"category":"...","tags":["..."],"keywords":["..."]}

제목: ${article.title}
내용: ${article.content.substring(0, 300)}`,
      }],
    })
    try {
      const text = fallbackRes.content[0].type === "text" ? fallbackRes.content[0].text : "{}"
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? "{}")
      classification = {
        category: CATEGORIES.includes(parsed.category) ? parsed.category : CATEGORIES[0],
        tags: parsed.tags ?? [],
        keywords: parsed.keywords ?? [],
      }
    } catch {
      classification = { category: CATEGORIES[0], tags: [], keywords: [] }
    }
  }

  // Claude Sonnet: 깊은 인사이트 분석
  const analysisRes = await claude.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: VOICE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `다음 마케팅 아티클을 분석해서 JSON 형식으로 응답해주세요.

아티클 제목: ${article.title}
아티클 내용:
${article.content.substring(0, 3000)}

다음 JSON 구조로 응답하세요:
{
  "hook": "독자를 낚는 한 줄 후킹 멘트 (20-35자, 질문형 또는 반전형, 예: 'SEO가 죽어가고 있다. 그 자리를 차지할 건 누구?')",
  "summary": "핵심 요약 (2-3문장, 자연스럽게)",
  "key_takeaways": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "why_it_matters": "왜 중요한가 (마케터 관점에서, 2-3단락)",
  "practical_applications": "실전 적용법 (구체적인 액션 아이템 포함, 2-3단락)",
  "framework_analysis": "활용된 마케팅 프레임워크 분석",
  "portfolio_usage": "포트폴리오에 어떻게 녹여낼 수 있는지 (STAR 방식 예시 포함)",
  "interview_points": ["실생활에서 이 인사이트를 바로 써볼 수 있는 구체적인 상황과 방법 1", "실생활에서 바로 써볼 수 있는 상황 2"]
}`,
      },
    ],
  })

  let analysis: Omit<InsightOutput, "slug" | "category" | "tags" | "keywords">
  try {
    const content = analysisRes.content[0]
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      analysis = JSON.parse(jsonMatch?.[0] ?? "{}")
    } else {
      throw new Error("Unexpected content type")
    }
  } catch {
    analysis = {
      hook: "",
      summary: "",
      key_takeaways: [],
      why_it_matters: "",
      practical_applications: "",
      framework_analysis: "",
      portfolio_usage: "",
      interview_points: [],
    }
  }

  return {
    slug: slugify(article.title),
    category: CATEGORY_LABELS[classification.category] ?? classification.category,
    tags: classification.tags ?? [],
    keywords: classification.keywords ?? [],
    ...stripMarkdown(analysis),
  }
}

function stripMarkdown<T extends Record<string, any>>(obj: T): T {
  const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s/gm, "").replace(/^>\s/gm, "")
  const result: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") result[k] = clean(v)
    else if (Array.isArray(v)) result[k] = v.map((i) => typeof i === "string" ? clean(i) : i)
    else result[k] = v
  }
  return result
}
