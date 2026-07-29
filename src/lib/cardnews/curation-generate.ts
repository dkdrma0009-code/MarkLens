import type { SupabaseClient } from "@supabase/supabase-js"
import { geminiJson } from "@/lib/ai/gemini"
import {
  selectLatest, validateCuration, CURATION_TREND_COUNT, CURATION_LIMITS,
} from "./curation-types"
import type {
  CurationCandidate, CurationCardnews, CurationSlide, CurationTrendSlide, CurationIntroSlide,
} from "./curation-types"

/* 주간 트렌드 큐레이션 생성 — 기존 카드뉴스 생성(generate/route.ts)과 완전히 별개 경로.
   흐름: 후보 조회 → selectLatest 5개 → LLM 으로 트렌드/표지 카피 다듬기 → 조립 →
   validateCuration → 실패 시 재시도 → 최후엔 하드 절삭으로 렌더가 안 깨지게.
   성과(performance)는 비워둔다(피드백 루프 자리). 저장·발행은 다음 단계. */

const L = CURATION_LIMITS
const clamp = (s: string, max: number) => {
  const a = [...(s ?? "")]
  return a.length <= max ? (s ?? "") : a.slice(0, max).join("")
}

/* ── 1) 후보 조회 ── 마크렌즈 발행일(cardnews.posted_at) 최신순 우선, 없으면 뒤로 밀어 보충. */
export async function fetchCurationCandidates(supabase: SupabaseClient, pool = 40): Promise<CurationCandidate[]> {
  const { data: cards } = await supabase
    .from("cardnews")
    .select("article_id, category, posted_at, updated_at")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(pool)
  if (!cards?.length) return []

  const ids = cards.map(c => c.article_id)
  const { data: insights } = await supabase
    .from("insights")
    .select("article_id, hook, summary, category, created_at")
    .in("article_id", ids)
  const byId = new Map((insights ?? []).map(r => [r.article_id, r]))

  const candidates: CurationCandidate[] = []
  for (const c of cards) {
    const ins = byId.get(c.article_id)
    if (!ins?.hook || !ins?.summary) continue // 재료 없는 건 제외
    candidates.push({
      articleId: c.article_id,
      title: ins.hook,          // 제목 = 인사이트 훅(펀치라인). 길면 LLM/절삭이 줄인다.
      summary: ins.summary,
      category: c.category ?? ins.category ?? "마케팅",
      // 정렬 기준: 마크렌즈 발행일 → 없으면 갱신일 → 인사이트 생성일
      createdAt: c.posted_at ?? c.updated_at ?? ins.created_at ?? new Date().toISOString(),
    })
  }
  return candidates
}

/* ── 2·3) LLM 카피 다듬기 ── */
interface LlmTrend { rank: number; title: string; summary: string }
interface LlmOut {
  intro: { headline: string[]; highlight?: string; saveHook: string }
  trends: LlmTrend[]
}

const SYSTEM = `너는 마케팅 미디어 'MarkLens'의 주간 트렌드 큐레이션 에디터다.
마크렌즈가 이번 주 주목한 마케팅 인사이트 ${CURATION_TREND_COUNT}개를 인스타 큐레이션 카드 카피로 다듬는다.

[원칙]
- 원본 기사 날짜로 "최신/방금/오늘" 같은 시점 주장 금지. 프레이밍은 항상 "마크렌즈가 이번 주 주목한".
- 사실을 지어내지 마라. 주어진 제목·요약의 의미만 압축한다.
- 경어체, 이모지 금지, 과장("충격·대박") 금지.

[글자수 — 공백·문장부호 포함 엄수, 제한 넘으면 디자인이 깨진다]
- trends: 각 {rank, title, summary}. rank 는 입력 순서 그대로 1..${CURATION_TREND_COUNT}.
  · title ≤${L.trendTitle}자 — 스크롤을 멈추는 핵심 한 줄.
  · summary ≤${L.trendSummary}자 — 한 문장 요약.
- intro: headline 2~3줄 배열(줄당 ≤${L.introHeadlineLine}자), 숫자 5가 들어가게(예: "주목한 트렌드 5").
  highlight 는 headline 에 실제 포함된 단어 1개(권장 "5"). saveHook ≤${L.introSaveHook}자 저장 유도 한 줄.

아래 JSON 만 출력:
{"intro":{"headline":["",""],"highlight":"","saveHook":""},"trends":[{"rank":1,"title":"","summary":""}]}`

async function refine(picked: CurationCandidate[], errs?: string[]): Promise<LlmOut | null> {
  const block = picked.map((c, i) => `${i + 1}. [${c.category}] 제목: ${c.title}\n   요약: ${c.summary}`).join("\n")
  const feedback = errs?.length ? `\n\n직전 출력에 문제가 있었다. 반드시 수정해 다시 출력하라:\n${errs.map(e => `- ${e}`).join("\n")}` : ""
  return geminiJson<LlmOut>(
    SYSTEM,
    `[마크렌즈가 이번 주 주목한 인사이트 ${picked.length}개]\n${block}${feedback}\n\n위를 큐레이션 카피로 다듬어라. JSON만.`,
    1500,
  )
}

/* ── 4) 고정 마무리 카피 ── */
const OUTRO = {
  headline: "매주 이렇게 정리해요",
  body: "월요일마다 마크렌즈가 주목한 트렌드를 큐레이션합니다.",
  cta: "프로필 링크 → 뉴스레터 구독",
}

/* ── 5) 조립 ── LLM 결과 + 후보(카테고리·articleId)를 합쳐 7장 구성. */
function assemble(llm: LlmOut | null, picked: CurationCandidate[], opts?: { title?: string; weekOf?: string }): CurationCardnews {
  const rawHeadline = Array.isArray(llm?.intro?.headline) && llm!.intro.headline.length
    ? llm!.intro.headline
    : ["이번 주 마크렌즈가", "주목한 트렌드 5"]
  const headline = rawHeadline.slice(0, 3)
  // llm 이 null 이거나 highlight 가 없으면 undefined. (빈 문자열은 includes 가 항상 true 라
  // 예전엔 llm!.intro 를 null 참조해 크래시했다.)
  const hl = llm?.intro?.highlight
  const highlight = hl && headline.some(l => l.includes(hl)) ? hl : undefined

  const slides: CurationSlide[] = [
    { type: "intro", headline, highlight, saveHook: llm?.intro?.saveHook?.trim() || "지금 저장 안 하면 못 찾아요" },
    ...picked.map((c, i): CurationTrendSlide => {
      const t = llm?.trends?.[i]
      return {
        type: "trend",
        item: {
          rank: i + 1,
          title: t?.title?.trim() || c.title,
          summary: t?.summary?.trim() || c.summary,
          category: c.category,
          articleId: c.articleId,
        },
      }
    }),
    { type: "outro", ...OUTRO },
  ]

  return {
    kind: "weekly-trend",
    title: opts?.title ?? `주간 트렌드 ${new Date().toISOString().slice(0, 10)}`,
    weekOf: opts?.weekOf,
    slides,
    createdAt: new Date().toISOString(),
    // performance 는 의도적으로 비움 — 나중에 피드백 루프가 채운다.
  }
}

/* 최후 안전망: 남은 글자수 위반을 하드 절삭. 렌더가 절대 깨지지 않게. */
function hardClamp(c: CurationCardnews): CurationCardnews {
  const slides = c.slides.map((s): CurationSlide => {
    if (s.type === "intro") {
      let headline = s.headline.slice(0, 3).map(l => clamp(l, L.introHeadlineLine))
      if (headline.length < 2) headline = [headline[0] ?? "이번 주 마크렌즈가", "주목한 트렌드 5"]
      const highlight = s.highlight && headline.some(l => l.includes(s.highlight!)) ? s.highlight : undefined
      return { ...s, headline, highlight, saveHook: clamp(s.saveHook, L.introSaveHook) }
    }
    if (s.type === "trend") {
      return { ...s, item: { ...s.item, title: clamp(s.item.title, L.trendTitle), summary: clamp(s.item.summary, L.trendSummary) } }
    }
    return { ...s, headline: clamp(s.headline, L.outroHeadline), body: clamp(s.body, L.outroBody), cta: clamp(s.cta, L.outroCta) }
  })
  return { ...c, slides }
}

/* ── 6) 인스타 캡션 ── 큐레이션(모음) 성격. cardnews 의 CAPTION_SYSTEM 과 별개. */
const CAPTION_SYSTEM = `너는 마케팅 미디어 'MarkLens'의 인스타그램 에디터다. 주간 트렌드 큐레이션(여러 인사이트를 묶은 모음) 게시물의 캡션을 쓴다.

[성격]
- 큐레이션(모음)임을 드러낸다. "이번 주 마크렌즈가 주목한 트렌드 N개를 정리했어요" 류.
- ⚠️ 원본 기사 날짜로 "최신 뉴스/방금/오늘" 주장 금지. 항상 "마크렌즈가 (이번 주) 주목한"으로 프레이밍.
- 경어체(~해요/~거든요), 과장("충격·대박") 금지, 이모지는 전체에서 최대 2개.

[구조 — 줄바꿈 포함]
1) 후킹 한 줄: 마크렌즈가 이번 주 주목한 트렌드 N개를 정리했다는 취지
2) (빈 줄)
3) 트렌드 목록: "1. 제목" 형식으로 N줄. 제공된 제목을 그대로(재작성 금지), 한 줄에 하나.
4) (빈 줄)
5) 저장 유도 한 줄: 나중에 다시 보게 저장하라는 취지
6) 더 깊은 분석은 프로필 링크 → 뉴스레터 구독
7) (빈 줄)
8) 해시태그 5~7개: #마케팅 #마케팅트렌드 #마케팅공부 #취준 #마케터 #큐레이션 #MarkLens

출력: {"caption":"전체 캡션 텍스트"} JSON만.`

function trendList(curation: CurationCardnews): string {
  return curation.slides
    .filter((s): s is CurationTrendSlide => s.type === "trend")
    .map(s => `${s.item.rank}. ${s.item.title}`)
    .join("\n")
}

// LLM 실패 시에도 발행이 막히지 않게 — 제목 목록 기반 템플릿 캡션.
function fallbackCaption(curation: CurationCardnews): string {
  const n = curation.slides.filter(s => s.type === "trend").length
  return `이번 주 마크렌즈가 주목한 마케팅 트렌드 ${n}개를 정리했어요.

${trendList(curation)}

나중에 다시 보려면 저장 필수 📌
더 깊은 분석은 프로필 링크 → 뉴스레터 구독

#마케팅 #마케팅트렌드 #마케팅공부 #취준 #마케터 #큐레이션 #MarkLens`
}

async function generateCurationCaption(curation: CurationCardnews): Promise<string> {
  const intro = curation.slides.find((s): s is CurationIntroSlide => s.type === "intro")
  const n = curation.slides.filter(s => s.type === "trend").length
  const result = await geminiJson<{ caption: string }>(
    CAPTION_SYSTEM,
    `표지: ${intro?.headline.join(" ") ?? ""}\n\n트렌드 ${n}개(이 제목을 캡션 목록에 그대로 넣어라):\n${trendList(curation)}\n\n이 큐레이션의 인스타 캡션을 작성하라. JSON만.`,
    1200,
  )
  return result?.caption?.trim() || fallbackCaption(curation)
}

export interface BuiltCuration { curation: CurationCardnews | null; warnings: string[] }

/* 후보 → 검증 통과한 CurationCardnews. */
export async function buildCuration(candidates: CurationCandidate[], opts?: { title?: string; weekOf?: string }): Promise<BuiltCuration> {
  const picked = selectLatest(candidates, CURATION_TREND_COUNT)
  if (picked.length < CURATION_TREND_COUNT) {
    return { curation: null, warnings: [`후보가 ${picked.length}개뿐 — ${CURATION_TREND_COUNT}개가 필요합니다`] }
  }

  const llm = await refine(picked)
  let curation = assemble(llm, picked, opts)
  let errs = validateCuration(curation)

  // 실패 시 1회 재시도(피드백 포함)
  if (errs.length && llm) {
    const retry = await refine(picked, errs)
    if (retry) {
      const c2 = assemble(retry, picked, opts)
      const e2 = validateCuration(c2)
      if (e2.length < errs.length) { curation = c2; errs = e2 }
    }
  }

  // 그래도 남으면 하드 절삭
  if (errs.length) {
    curation = hardClamp(curation)
    errs = validateCuration(curation)
  }

  // 캡션 — 최종 확정된 슬라이드(제목)를 근거로 생성해 카드와 목록이 일치하게.
  curation.caption = await generateCurationCaption(curation)

  return { curation, warnings: errs }
}

/* 조회+조립 원스텝 — 나중에 라우트/크론에서 호출. */
export async function generateCuration(supabase: SupabaseClient, opts?: { title?: string; weekOf?: string }): Promise<BuiltCuration> {
  const candidates = await fetchCurationCandidates(supabase)
  return buildCuration(candidates, opts)
}
