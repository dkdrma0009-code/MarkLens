import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { geminiJson } from "@/lib/ai/gemini"
import { validateCardnews, validateSlideAll } from "@/lib/cardnews/validate"
import { type Cardnews, type Slide } from "@/lib/cardnews/types"
import { NextResponse } from "next/server"
import { actionSources, editorialCopyErrors, groundedCopyErrors, type CopySource } from "@/lib/cardnews/grounded-copy"

export const maxDuration = 120

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 스펙 5.3 시스템 프롬프트
const LEGACY_SYSTEM = `당신은 마케팅 미디어 'MarkLens'의 카드뉴스 에디터다.
주어진 아티클을 인스타그램 카드뉴스 6장 분량의 카피로 변환한다.

[전략 원칙]
- 인스타에서는 "무슨 일이 왜 중요한지"까지만 전달한다.
- "어떻게 써먹는지"의 핵심(면접 답변, 상세 적용법)은 절대 다 풀지 않는다. 사이트 유입 미끼로 남긴다.
- slide 4(apply)에는 적용법 중 딱 1개만 담는다.
- 타겟은 마케팅 취준생과 주니어 마케터. 저장하고 싶게 만드는 게 목표다.

[카피 규칙]
- cover.headline (가장 중요 — 첫 3초에 스크롤을 멈추게 하는 후킹이 생명. 조회수는 여기서 갈린다): 줄당 최대 12자, 2~3줄 배열.
  [첫 3초 룰 — 반드시]
   · 숫자를 최우선으로. 자료에 수치(%·배수·금액·인원·기간)가 있으면 반드시 헤드라인에 박아라 — 숫자는 스크롤을 멈추는 가장 강한 장치다.
   · 추상 < 구체. "~하는 법 / ~전략" 같은 뭉뚱그린 말 대신 결과·변화·사건을 보여라.
     (나쁨: "AI로 마케팅 분석하는 법" → 좋음: "AI 5분컷, 전환율 3배")
   · 아래 후킹 공식 중 하나 이상을 써라:
     ① 궁금증: "왜 ~했을까?", "그래서 어떻게 됐을까"
     ② 의외성·반전: "광고를 안 하는 광고", "적자인데 1위"
     ③ 위기감·결핍: "이거 모르면 면접서 막힘", "남들 다 아는데 나만"
     ④ 구체 숫자·결과: "마케터 90%가 놓친", "3주 만에 매출 2배"
  금지: 정보 나열형 제목("구글 마케팅 라이브 요약" 같은 건 안 멈춘다), 기사 제목 복붙.
  단 "충격·대박·소름·미쳤다" 류 싸구려 낚시 과장은 금지(신뢰 훼손). 숫자·궁금증·의외성은 반드시 사실에 근거할 것 — 자료에 없는 수치를 지어내지 마라.
- cover.highlight: 헤드라인에 실제로 포함된 단어 1개만 지정.
- cover.sub: 최대 18자 한 줄.
- fact.body: 2~3문장, 총 90자 이내. 팩트만, 의견 배제.
- why.headline: 최대 16자. 타겟의 고통/욕망을 건드리는 문장.
- why.body: 2~3문장, 총 90자 이내.
- apply.body: 1~2문장, 총 80자 이내. "면접·실무에서 바로 쓰는 한 문장"으로 — 저장하고 싶게 만드는 실전 팁.
- keywords: 2~3개. word는 최대 12자, desc는 최대 22자.
- cta는 고정 패턴 유지하되 headline은 아티클에 맞게 변형 가능.
- 전체 톤: 간결한 경어체("~합니다"). 이모지 금지.

[글자수 엄수 — 가장 중요]
- 글자수는 공백·문장부호·영문자 전부 포함해서 센다. 제한을 1자라도 넘기면 디자인이 깨져 사용 불가.
- 제한의 90% 이내를 목표로 짧게 써라. 길어질 것 같으면 문장을 쪼개지 말고 내용을 빼라.
- 긴 영문 용어(예: Demand Gen, Asset Studio)는 cover.headline에 넣지 마라. sub나 body에 배치하라.

[출력]
- 지정된 JSON 스키마로만 출력한다. JSON 외 어떤 텍스트도 출력하지 않는다.`

const LEGACY_SCHEMA_HINT = `{
  "category": "AI 마케팅",
  "slides": [
    { "type": "cover", "headline": ["줄1", "줄2"], "highlight": "단어", "sub": "서브 한 줄" },
    { "type": "fact", "body": "...", "source": "출처명" },
    { "type": "why", "headline": "...", "body": "..." },
    { "type": "apply", "body": "..." },
    { "type": "keywords", "keywords": [{ "word": "...", "desc": "..." }] },
    { "type": "cta", "headline": "이 얘기, 면접에서 어떻게 말할까?", "body": "\\"면접에서 이렇게 말해보세요\\" 풀버전은 프로필 링크에서" }
  ]
}`

const SYSTEM = `당신은 MarkLens의 에디토리얼 에디터다. 기존 분석의 의미를 유지해 Instagram 발견용 카피를 쓴다.
각 슬라이드는 메시지 하나만. 새 주장·수치·근거를 만들지 않는다. 제목은 기존 hook을 안전하게 압축한다.
role 순서: hook → what → [context] → [why] → take → [action] → [end].
5~7장. hook/what/take는 필수, context/why 중 실제 근거가 있는 것 하나 이상, action/end 중 하나 이상.
각 role은 전체 slides 배열에 최대 한 번만 나온다. ACTION도 반드시 단 하나의 slide다.
근거 없는 Action은 생략한다: hook/what/why/take/end 또는 hook/what/context/take/end.
Why가 Context의 반복이라면 생략한다: hook/what/context/take/action/end.
내용이 충분할 때만 추가한다. 같은 설명을 반복하거나 빈 장을 채우지 않는다.
type은 기존 JSON을 재사용: hook=cover, what=fact, context/why/take=why, action=apply, end=cta.
HOOK은 입력 hook/title/summary의 실제 주체와 사건/변화/문제를 보존한다. '새로운 발견/기회/변화' 같은 어디에나 붙는 표현 금지.
HOOK은 주체 하나와 사건 하나만. 관련 회사/캠페인 명칭을 모두 나열하지 않는다. 두 의미 줄을 우선하고 영문명을 길게 쓰면 다른 설명을 줄인다.
what은 사건 하나, context는 이를 이해할 근거/배경 하나, why는 원인 또는 중요성 하나다. 같은 핵심 주장을 바꿔 말하는 인접 장은 금지.
take는 framework_analysis/why_it_matters의 실제 해석을 압축한다. summary를 반복하거나 근거보다 강한 확신을 만들지 않는다.
ACTION은 아래 [행동 근거]의 서로 다른 ID에 일대일 대응한다. 입력 1개면 최대 1개, 2개면 최대 2개, 0개면 action 생략.
같은 행동을 설명/효과/예시로 쪼개 3개처럼 늘리지 않는다. 문장 두 개여도 한 행동이면 같은 항목으로 유지한다.
각 행동은 한 줄, 동사형, 최대 3개. 여러 행동은 단 하나의 action.body 문자열 안에 \\n으로 구분한다. 행동별 별도 slide 생성 금지.
입력의 핵심 동사를 보존하고 '~하세요' 형태로 쓴다. '영향을 파악'을 '영향력 강화'로 바꾸는 목표 변경 금지.
actionSourceIds 배열은 최상위 JSON에만 넣는다(slide 안에는 절대 넣지 않는다). 그 배열은 action.body 각 줄의 근거 ID 순서다. 같은 ID 재사용 금지.
end는 짧은 마무리만. 자세한 분석은 사이트에서 읽는다.
category는 입력 값을 그대로 유지한다. cover headline은 2~3개 의미 줄, 한글은 줄당 12자 수준을 목표로 한다.
공식 영문 브랜드/주체 이름은 12자로 자르거나 임의 축약하지 않는다. 단어 경계 개행을 우선하고 다른 수식어를 제거한다.
category와 공식 브랜드명은 다른 역할이다. category는 별도 label, 공식명과 사건은 headline에 보존한다. sub ≤18자,
why 타입 headline ≤16자/body ≤90자, fact body ≤90자, apply body 전체 ≤80자.
길이 목표는 fact/why body 60~70자, action 전체 50~60자다. 한도 끝까지 채우지 않는다.
Action은 항목당 15~20자 수준의 짧은 동사형이다. 예: '지역 예술가와 협업하세요.' / '예술형 콘텐츠를 기획하세요.'
What은 사건 한 문장만. 관련 회사명/캠페인 공식명을 모두 나열하지 않고 주체와 사건을 보존한다.
숫자는 제공된 원문에 명시된 것만. DATA 후보 context.body는 수치를 포함한 원문 문장을 그대로 인용(90자 이하)한다.
적합한 원문 수치가 없으면 context는 관찰로 쓰거나 생략한다. 추정·전망 수치를 결과처럼 쓰지 않는다.
간결한 한국어 경어체, 과장·이모지 금지. 지정된 JSON만 출력한다.`

const SCHEMA_HINT = `{"category":"입력 category 그대로", "slides":[
{"type":"cover","role":"hook","headline":["줄1","줄2"]},
{"type":"fact","role":"what","body":"사건","source":"출처명"},
{"type":"why","role":"context","headline":"배경","body":"관찰 또는 원문 수치 인용"},
{"type":"why","role":"why","headline":"이유","body":"변화의 이유"},
{"type":"why","role":"take","headline":"해석","body":"기존 분석의 독자적 해석"},
{"type":"apply","role":"action","body":"첫 번째 실제 행동\\n두 번째 실제 행동"},
{"type":"cta","role":"end","headline":"짧은 마무리","body":"전체 맥락은 MarkLens에서."}
],"actionSourceIds":[1,2]}`

interface ArticleInput extends CopySource {
  title: string
  source: string
  category: string
  hook: string
  summary: string
  why: string
  apply: string
  takeaways: string[]
  raw: string
}

interface GeneratedCardnews extends Cardnews { actionSourceIds?: number[] }

function generationErrors(data: GeneratedCardnews, input: ArticleInput): string[] {
  return [...validateCardnews(data), ...groundedCopyErrors(data, input, data.actionSourceIds)]
}

function copyLimits(type: Slide["type"], v2: boolean): string {
  if (v2 && type === "cover") return "headline 2~3개 의미 줄, 공식명 단어 경계 개행. 공식 영문명은 12자 제한/임의 축약 금지. 수식어 제거, sub ≤18자"
  if (v2 && type === "apply") return "서로 다른 입력 행동 근거에 일대일 대응, 각 항목 한 줄/~하세요 동사형/15~20자 목표. 전체 50~60자 목표, 절대 ≤80자. 같은 행동을 분할하거나 핵심 동사를 변경하지 말 것"
  return LIMIT_RULES[type]
}

function buildArticleBlock(a: ArticleInput): string {
  return `[아티클]
제목: ${a.title}
카테고리: ${a.category}
훅: ${a.hook}
핵심 요약: ${a.summary}
왜 중요한가: ${a.why.slice(0, 800)}
실전 적용법: ${a.apply.slice(0, 800)}
해석 프레임워크: ${(a.framework ?? "").slice(0, 800)}
포트폴리오 활용: ${(a.portfolio ?? "").slice(0, 400)}
면접 활용: ${(a.interview ?? []).join(" / ").slice(0, 600)}
[행동 근거 — 입력의 명시적인 의미 단위, 이것만 ACTION에 사용]
${actionSources(a).map((unit, i) => `${i + 1}: ${unit}`).join("\n") || "없음 — Action을 생략하고 End로 마감"}
핵심 포인트: ${a.takeaways.join(" / ")}
출처: ${a.source}
원문 발췌 (숫자 검증용): ${a.raw.slice(0, 3000)}`
}

async function generateAll(a: ArticleInput): Promise<{ data: GeneratedCardnews | null; warnings: string[] }> {
  const units = actionSources(a)
  const schema = units.length ? SCHEMA_HINT : `{"category":"입력 category 그대로","slides":[
{"type":"cover","role":"hook","headline":["실제 주체","사건 또는 변화"]},
{"type":"fact","role":"what","body":"실제 사건","source":"입력 출처"},
{"type":"why","role":"why","headline":"원인 또는 중요성","body":"입력 근거"},
{"type":"why","role":"take","headline":"입력 해석","body":"framework/why 근거 해석"},
{"type":"cta","role":"end","headline":"MarkLens","body":"전체 맥락은 MarkLens에서."}
],"actionSourceIds":[]}`
  const prompt = `${buildArticleBlock(a)}

아래 JSON 스키마는 role별 모양의 예시다. 정보가 부족하거나 중복인 context/why/action/end는 생략해 실제 5~7장을 구성한다. action이 없으면 actionSourceIds는 []:
ACTION 최대 ${Math.min(3, units.length)}개. ${units.length ? "근거 있는 서로 다른 행동만 단 하나의 Action slide 안에 넣는다." : "Action은 없다. End는 반드시 포함한다. Hook/What/Why/Take/End 5장으로 마감한다."}
${schema}`

  let data = await geminiJson<GeneratedCardnews>(SYSTEM, prompt, 2500)
  let errors = data ? generationErrors(data, a) : ["JSON 파싱 실패"]

  // 검증 실패 시 1회 재시도 (스펙 5.4 — 초과 사실을 피드백에 포함)
  if (errors.length && data) {
    const retry = await geminiJson<GeneratedCardnews>(
      SYSTEM,
      `${prompt}

직전 출력에 다음 문제가 있었다. 반드시 수정해서 다시 출력하라:
${errors.map(e => `- ${e}`).join("\n")}`,
      2500
    )
    if (retry) {
      const retryErrors = generationErrors(retry, a)
      if (retryErrors.length < errors.length) {
        data = retry
        errors = retryErrors
      }
    }
  }

  return { data, warnings: errors }
}

const LIMIT_RULES: Record<Slide["type"], string> = {
  cover: "headline 각 줄 ≤12자(공백 포함) 2~3줄 배열, sub ≤18자, highlight는 헤드라인에 실제 포함된 단어 1개",
  fact: "body ≤90자(공백·문장부호 포함) 2~3문장, source 유지",
  why: "headline ≤16자, body ≤90자",
  apply: "body ≤80자 1~2문장",
  keywords: "키워드 2~3개, word ≤12자, desc ≤22자",
  cta: "고정 패턴 유지, headline은 아티클에 맞게 변형 가능",
}

async function generateOne(a: ArticleInput, type: Slide["type"], current: Slide, n: number): Promise<{ slide: Slide | null; warnings: string[]; sourceIds?: number[] }> {
  const prompt = `${buildArticleBlock(a)}

카드뉴스의 "${type}" 슬라이드 1장만 새로 작성하라. 역할 ${current.role ?? type}과 의미를 유지한다.
전체 구조 참고 (반환은 해당 slide 하나만): ${current.role ? SCHEMA_HINT : LEGACY_SCHEMA_HINT}
제한: ${copyLimits(type, !!current.role)}
기존 버전: ${JSON.stringify(current)}

JSON으로만 출력: {"slide": { "type": "${type}", ... }, "actionSourceIds": [행동인 경우 실제 입력 ID]}`

  const result = await geminiJson<{ slide: Slide; actionSourceIds?: number[] }>(current.role ? SYSTEM : LEGACY_SYSTEM, prompt, 800)
  if (!result?.slide || result.slide.type !== type) return { slide: null, warnings: ["재생성 실패"] }
  if (current.role) result.slide.role = current.role
  else delete result.slide.role
  return { slide: result.slide, sourceIds: result.actionSourceIds, warnings: [...validateSlideAll(result.slide, n), ...(current.role ? [...editorialCopyErrors([result.slide]), ...groundedCopyErrors({ category: a.category, slides: [result.slide] }, a, result.actionSourceIds)] : [])] }
}

// 글자수 초과 슬라이드 압축 재작성 — 후보 3개를 받아 검증 통과분을 서버가 선택
async function repairSlide(a: ArticleInput, type: Slide["type"], current: Slide, errors: string[], n: number): Promise<Slide | null> {
  const prompt = `${buildArticleBlock(a)}

아래 "${type}" 슬라이드 카피가 글자수 제한을 초과했다. 핵심 의미는 유지하면서 훨씬 짧게 압축한 버전 3개를 써라. 각 버전은 표현을 다르게.
위반 사항: ${errors.join(" / ")}
제한: ${copyLimits(type, !!current.role)}
불필요한 수식어 → 중복 의미 순서로 줄인다. 공식명/수치/사건/주체/변화 방향은 삭제하거나 임의 축약하지 않는다.
제한의 80% 이하 길이가 목표다. 기존 문장 구조를 고집하지 말고 수식어/부가 설명을 제거해 짧게 다시 쓴다.
ACTION 항목 수와 근거 순서를 유지한다. 짧게 만들기 위해 행동을 새로 만들거나 분할하지 않는다.
기존: ${JSON.stringify(current)}

JSON으로만 출력: {"candidates": [{ "type": "${type}", ... }, { "type": "${type}", ... }, { "type": "${type}", ... }]}`

  const result = await geminiJson<{ candidates: Slide[] }>(current.role ? SYSTEM : LEGACY_SYSTEM, prompt, 1500)
  const candidates = (result?.candidates ?? []).filter(c => c?.type === type)
  if (!candidates.length) return null

  // 완전 통과 후보 우선, 없으면 위반이 가장 적은 후보
  let best: Slide | null = null
  let bestErrs = Infinity
  for (const c of candidates) {
    if (current.role) c.role = current.role
    else delete c.role
    const count = validateSlideAll(c, n).length
    if (count === 0) return c
    if (count < bestErrs) { best = c; bestErrs = count }
  }
  return best
}

// 인스타 캡션 생성 — 바크 매거진 레퍼런스 구조 (후킹 제목 → 구어체 본문+질문 → 링크 유도 → 시그니처 → 태그)
const CAPTION_SYSTEM = `너는 마케팅 미디어 'MarkLens'의 인스타그램 에디터다. 카드뉴스 게시물의 캡션을 작성한다.

반드시 아래 구조를 따른다 (줄바꿈 포함):
1) 이모지 1개 + 핵심 한 줄 제목 — 카드뉴스 헤드라인을 재해석 (복붙 금지)
2) (빈 줄)
3) 본문 3~4문장 — 인사이트 핵심을 친근한 해요체로 풀어쓰기. 마지막 문장은 독자가 자기 일에 대입해보게 하는 가벼운 질문으로 마무리
4) (빈 줄)
5) "면접에서 이렇게 말해보세요" 풀버전은 프로필 링크에서 🔍 — 아티클에 맞게 자연스럽게 변형 가능
6) (빈 줄)
7) 저장·공유 유도 한 줄 — 내용에 맞게 변형. 예: "면접에서 써먹고 싶으면 저장 📌 / 마케팅 준비하는 친구 태그 👀" (사람들은 명시적으로 시켜야 저장·공유한다)
8) (빈 줄)
9) 트렌드를 실전으로 바꾸는 마크렌즈 | @marklens 🔍
10) (빈 줄)
11) 해시태그 6~7개: #마케팅 #(카테고리) #마케팅트렌드 #마케팅공부 #취준 #마케터 #MarkLens

톤: 부드러운 해요체("~해요", "~거든요"). 과장 표현 금지. 이모지는 제목 1개 + 본문에 최대 1개.
출력: {"caption": "전체 캡션 텍스트"} JSON만.`

async function generateCaption(a: ArticleInput, slides: Slide[]): Promise<string | null> {
  const cover = slides[0]?.type === "cover" ? (slides[0] as { headline: string[] }) : null
  const result = await geminiJson<{ caption: string }>(
    CAPTION_SYSTEM,
    `${buildArticleBlock(a)}

카드뉴스 표지 헤드라인: ${cover ? cover.headline.join(" ") : a.hook}

이 카드뉴스의 인스타그램 캡션을 작성하라. JSON만 반환.`,
    1000
  )
  return result?.caption?.trim() || null
}

// 위반 슬라이드만 골라 최대 2라운드 압축 보정
async function repairLoop(a: ArticleInput, slides: Slide[]): Promise<Slide[]> {
  for (let round = 0; round < 2; round++) {
    const bad = slides
      .map((s, i) => ({ i, errs: validateSlideAll(s, i + 1) }))
      .filter(x => x.errs.length > 0)
    if (!bad.length) break

    await Promise.all(bad.map(async ({ i, errs }) => {
      const type = slides[i].type
      const fixed = await repairSlide(a, type, slides[i], errs, i + 1)
      if (fixed && validateSlideAll(fixed, i + 1).length < errs.length) {
        slides[i] = fixed
      }
    }))
  }
  return slides
}

export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const articleId = body.articleId as string
  const slideIndex = typeof body.slide === "number" ? body.slide : null // 1~6, 단일 재생성
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const supabase = createAdminClient()
  const [{ data: article }, { data: insight }] = await Promise.all([
    supabase.from("articles").select("title, source_name, raw_content").eq("id", articleId).single(),
    supabase.from("insights").select("hook, category, summary, why_it_matters, practical_applications, key_takeaways, framework_analysis, portfolio_usage, interview_points").eq("article_id", articleId).single(),
  ])

  if (!article || !insight) {
    return NextResponse.json({ error: "아티클 또는 인사이트를 찾을 수 없습니다" }, { status: 404 })
  }

  const input: ArticleInput = {
    title: article.title ?? "",
    source: article.source_name ?? "",
    category: insight.category ?? "마케팅",
    hook: insight.hook ?? "",
    summary: insight.summary ?? "",
    why: insight.why_it_matters ?? "",
    apply: insight.practical_applications ?? "",
    takeaways: Array.isArray(insight.key_takeaways) ? insight.key_takeaways : [],
    raw: article.raw_content ?? "",
    framework: insight.framework_analysis ?? "",
    portfolio: insight.portfolio_usage ?? "",
    interview: Array.isArray(insight.interview_points) ? insight.interview_points : [],
  }

  // ── 단일 슬라이드 재생성 ──
  if (slideIndex !== null) {
    const { data: existing } = await supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single()
    if (!existing?.slides) return NextResponse.json({ error: "먼저 전체 생성을 실행하세요" }, { status: 400 })

    const slides = existing.slides as Slide[]
    if (!Number.isInteger(slideIndex) || slideIndex < 1 || slideIndex > slides.length)
      return NextResponse.json({ error: "slide 범위가 유효하지 않습니다" }, { status: 400 })
    const type = slides[slideIndex - 1].type
    const generated = await generateOne(input, type, slides[slideIndex - 1], slideIndex)
    let { slide, warnings } = generated
    const { sourceIds } = generated
    if (!slide) return NextResponse.json({ error: "재생성 실패" }, { status: 500 })

    // 글자수 위반 시 압축 보정 1회
    if (warnings.length) {
      const fixed = await repairSlide(input, type, slide, warnings, slideIndex)
      if (fixed && validateSlideAll(fixed, slideIndex).length < warnings.length) {
        slide = fixed
        warnings = validateSlideAll(fixed, slideIndex)
      }
    }

    slides[slideIndex - 1] = slide
    if (slide.role) {
      warnings = [...validateCardnews({ category: existing.category ?? input.category, slides }), ...groundedCopyErrors({ category: input.category, slides: [slide] }, input, sourceIds)]
      if (warnings.length) return NextResponse.json({ error: "V2 카피 검증 실패", warnings }, { status: 422 })
    }
    const { error } = await supabase.from("cardnews").upsert({
      article_id: articleId, slides, category: existing.category ?? input.category, updated_at: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ slides, category: existing.category ?? input.category, warnings })
  }

  // ── 전체 생성 ──
  const { data } = await generateAll(input)
  if (!data?.slides) return NextResponse.json({ error: "카피 생성 실패" }, { status: 500 })

  // 글자수 위반 슬라이드 압축 재작성과 캡션 생성을 병렬로
  const [repairedSlides, caption] = await Promise.all([
    repairLoop(input, data.slides),
    generateCaption(input, data.slides),
  ])
  data.slides = repairedSlides
  const warnings = generationErrors(data, input)
  if (warnings.length || !data.slides.every(s => s.role))
    return NextResponse.json({ error: "V2 카피 검증 실패", warnings }, { status: 422 })

  const category = input.category
  const { error } = await supabase.from("cardnews").upsert({
    article_id: articleId, slides: data.slides, category, updated_at: new Date().toISOString(),
  })
  if (error) {
    // 테이블 미생성 등 — 명확한 안내
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 })
  }

  // 캡션은 별도 저장 — caption 컬럼이 아직 없어도 본체 저장은 유지
  if (caption) {
    const { error: capErr } = await supabase.from("cardnews").update({ caption }).eq("article_id", articleId)
    if (capErr) warnings.push(`캡션 저장 실패 (cardnews.caption 컬럼 확인): ${capErr.message}`)
  }

  return NextResponse.json({ slides: data.slides, category, caption, warnings })
}
