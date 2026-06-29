import { geminiJson } from "@/lib/ai/gemini"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export const maxDuration = 60

interface Question {
  question: string
  kind: "trend" | "role" | "behavioral"
}

const SYSTEM = `너는 한국 기업의 마케팅·MCN·콘텐츠 직무 면접관이야. 지원자의 자기소개서, 포트폴리오, 채용공고를 분석해서 실제 최종 면접에서 나올 법한 날카로운 맞춤 질문을 만들어.

규칙:
- behavioral: 자기소개서/포트폴리오에 언급된 특정 경험·프로젝트·수치를 직접 언급하며 파고드는 질문. 예: "자기소개서에 언급하신 [프로젝트명]에서 [구체적 상황]을 어떻게 해결하셨나요?"
  추상적이거나 누구에게나 해당하는 질문 절대 금지 ("본인의 강점은?", "마케팅이란?" 등)
- role: 해당 기업의 구체적인 직무(JD에 명시된 업무)를 수행하는 능력을 검증하는 실무형 질문
- trend: 해당 기업이 속한 산업(MCN, 유튜브, 콘텐츠 마케팅 등)의 최신 동향이나 실무 지식을 묻는 질문
- 자연스러운 한국어 구어체 존댓말 (실제 면접관처럼)
- 마크다운 금지

JSON만 반환: {"questions":[{"question":"...","kind":"behavioral"},...]}
`

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "interview-custom", limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const { companyName, jobTitle, jd, coverLetter, portfolio, count } = body as {
    companyName?: string
    jobTitle?: string
    jd?: string
    coverLetter?: string
    portfolio?: string
    count?: number
  }

  if (!coverLetter?.trim() && !jd?.trim()) {
    return NextResponse.json({ error: "자기소개서 또는 채용공고를 입력해주세요" }, { status: 400 })
  }

  const n = Math.min(Math.max(Number(count) || 5, 3), 7)

  const prompt = `지원 기업: ${String(companyName ?? "미입력").slice(0, 100)}
직무: ${String(jobTitle ?? "마케팅").slice(0, 100)}

[채용공고/JD]
${String(jd ?? "(미입력)").slice(0, 2000)}

[자기소개서]
${String(coverLetter ?? "(미입력)").slice(0, 3000)}

[포트폴리오 요약]
${String(portfolio ?? "(미입력)").slice(0, 2000)}

위 내용을 바탕으로 면접 질문 ${n}개를 만들어줘.
구성: behavioral ${Math.ceil(n / 2)}개 (자기소개서 경험 기반, 구체적 사례 인용), role 1~2개, trend 1개.
JSON만 반환해.`

  const result = await geminiJson<{ questions: Question[] }>(SYSTEM, prompt, 1500)

  if (!result?.questions?.length) {
    return NextResponse.json({ error: "질문 생성 실패" }, { status: 500 })
  }

  return NextResponse.json({ questions: result.questions.slice(0, n) })
}
