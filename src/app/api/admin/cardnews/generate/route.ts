import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { geminiJson } from "@/lib/ai/gemini"
import { validateCardnews, validateSlideAll } from "@/lib/cardnews/validate"
import { SLIDE_ORDER, type Cardnews, type Slide } from "@/lib/cardnews/types"
import { NextResponse } from "next/server"

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
const SYSTEM = `당신은 마케팅 미디어 'MarkLens'의 카드뉴스 에디터다.
주어진 아티클을 인스타그램 카드뉴스 6장 분량의 카피로 변환한다.

[전략 원칙]
- 인스타에서는 "무슨 일이 왜 중요한지"까지만 전달한다.
- "어떻게 써먹는지"의 핵심(면접 답변, 상세 적용법)은 절대 다 풀지 않는다. 사이트 유입 미끼로 남긴다.
- slide 4(apply)에는 적용법 중 딱 1개만 담는다.
- 타겟은 마케팅 취준생과 주니어 마케터. 저장하고 싶게 만드는 게 목표다.

[카피 규칙]
- cover.headline (가장 중요 — 첫 장에서 스크롤을 멈추게 하는 후킹이 생명이다): 줄당 최대 12자, 2~3줄 배열.
  아래 후킹 공식 중 하나를 반드시 써라:
   ① 궁금증: "왜 ~했을까?", "그래서 어떻게 됐을까"
   ② 의외성·반전: "육아를 격투기로?", "광고를 안 하는 광고"
   ③ 위기감·결핍: "이거 모르면 면접서 막힘", "남들 다 아는데 나만"
   ④ 구체 숫자: "마케터 90%가 놓친"
  금지: 정보 나열형 제목("구글 마케팅 라이브 요약" 같은 건 안 멈춘다), 기사 제목 복붙.
  단 "충격·대박·소름·미쳤다" 류 싸구려 낚시 과장은 금지(신뢰 훼손). 궁금증·의외성은 반드시 사실에 근거할 것.
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

const SCHEMA_HINT = `{
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

interface ArticleInput {
  title: string
  source: string
  category: string
  hook: string
  summary: string
  why: string
  apply: string
  takeaways: string[]
}

function buildArticleBlock(a: ArticleInput): string {
  return `[아티클]
제목: ${a.title}
카테고리: ${a.category}
훅: ${a.hook}
핵심 요약: ${a.summary}
왜 중요한가: ${a.why.slice(0, 800)}
실전 적용법: ${a.apply.slice(0, 800)}
핵심 포인트: ${a.takeaways.join(" / ")}
출처: ${a.source}`
}

async function generateAll(a: ArticleInput): Promise<{ data: Cardnews | null; warnings: string[] }> {
  const prompt = `${buildArticleBlock(a)}

아래 JSON 스키마로 카드뉴스 6장을 출력하라:
${SCHEMA_HINT}`

  let data = await geminiJson<Cardnews>(SYSTEM, prompt, 2500)
  let errors = data ? validateCardnews(data) : ["JSON 파싱 실패"]

  // 검증 실패 시 1회 재시도 (스펙 5.4 — 초과 사실을 피드백에 포함)
  if (errors.length && data) {
    const retry = await geminiJson<Cardnews>(
      SYSTEM,
      `${prompt}

직전 출력에 다음 문제가 있었다. 반드시 수정해서 다시 출력하라:
${errors.map(e => `- ${e}`).join("\n")}`,
      2500
    )
    if (retry) {
      const retryErrors = validateCardnews(retry)
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

async function generateOne(a: ArticleInput, type: Slide["type"], current: Slide): Promise<{ slide: Slide | null; warnings: string[] }> {
  const prompt = `${buildArticleBlock(a)}

카드뉴스의 "${type}" 슬라이드 1장만 새로 작성하라. 기존 버전과 다른 각도로.
제한: ${LIMIT_RULES[type]}
기존 버전: ${JSON.stringify(current)}

JSON으로만 출력: {"slide": { "type": "${type}", ... }}`

  const result = await geminiJson<{ slide: Slide }>(SYSTEM, prompt, 800)
  if (!result?.slide || result.slide.type !== type) return { slide: null, warnings: ["재생성 실패"] }
  const idx = SLIDE_ORDER.indexOf(type)
  return { slide: result.slide, warnings: validateSlideAll(result.slide, idx + 1) }
}

// 글자수 초과 슬라이드 압축 재작성 — 후보 3개를 받아 검증 통과분을 서버가 선택
async function repairSlide(a: ArticleInput, type: Slide["type"], current: Slide, errors: string[]): Promise<Slide | null> {
  const idx = SLIDE_ORDER.indexOf(type) + 1
  const prompt = `${buildArticleBlock(a)}

아래 "${type}" 슬라이드 카피가 글자수 제한을 초과했다. 핵심 의미는 유지하면서 훨씬 짧게 압축한 버전 3개를 써라. 각 버전은 표현을 다르게.
위반 사항: ${errors.join(" / ")}
제한: ${LIMIT_RULES[type]}
글자수는 공백·문장부호 포함. 제한의 80% 길이를 목표로 과감하게 줄여라. 수식어부터 빼라.
기존: ${JSON.stringify(current)}

JSON으로만 출력: {"candidates": [{ "type": "${type}", ... }, { "type": "${type}", ... }, { "type": "${type}", ... }]}`

  const result = await geminiJson<{ candidates: Slide[] }>(SYSTEM, prompt, 1500)
  const candidates = (result?.candidates ?? []).filter(c => c?.type === type)
  if (!candidates.length) return null

  // 완전 통과 후보 우선, 없으면 위반이 가장 적은 후보
  let best: Slide | null = null
  let bestErrs = Infinity
  for (const c of candidates) {
    const n = validateSlideAll(c, idx).length
    if (n === 0) return c
    if (n < bestErrs) { best = c; bestErrs = n }
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
7) 트렌드를 실전으로 바꾸는 마크렌즈 | @marklens 🔍
8) (빈 줄)
9) 해시태그 6~7개: #마케팅 #(카테고리) #마케팅트렌드 #마케팅공부 #취준 #마케터 #MarkLens

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
      const type = SLIDE_ORDER[i]
      const fixed = await repairSlide(a, type, slides[i], errs)
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
    supabase.from("articles").select("title, source_name").eq("id", articleId).single(),
    supabase.from("insights").select("hook, category, summary, why_it_matters, practical_applications, key_takeaways").eq("article_id", articleId).single(),
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
  }

  // ── 단일 슬라이드 재생성 ──
  if (slideIndex !== null) {
    const { data: existing } = await supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single()
    if (!existing?.slides) return NextResponse.json({ error: "먼저 전체 생성을 실행하세요" }, { status: 400 })

    const slides = existing.slides as Slide[]
    const type = SLIDE_ORDER[slideIndex - 1]
    let { slide, warnings } = await generateOne(input, type, slides[slideIndex - 1])
    if (!slide) return NextResponse.json({ error: "재생성 실패" }, { status: 500 })

    // 글자수 위반 시 압축 보정 1회
    if (warnings.length) {
      const fixed = await repairSlide(input, type, slide, warnings)
      if (fixed && validateSlideAll(fixed, slideIndex).length < warnings.length) {
        slide = fixed
        warnings = validateSlideAll(fixed, slideIndex)
      }
    }

    slides[slideIndex - 1] = slide
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
  const warnings = validateCardnews(data)

  const category = data.category || input.category
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
