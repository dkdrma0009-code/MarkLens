import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { getMediaInsight } from "@/lib/instagram"
import { geminiJson } from "@/lib/ai/gemini"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 60

// 성장 플레이북 P1(원인 분석)을 MarkLens 톤으로 내장 — 지표+표지 문구로 "왜 안 터졌나 + 첫 3초 개선안"
const SYSTEM = `너는 MarkLens의 인스타그램 성장 분석가다. 발행된 게시물의 지표와 표지 문구를 보고, 왜 반응이 약했는지 냉정하게 진단하고 첫 3초(표지 훅)를 어떻게 고칠지 제안한다.
타깃은 마케팅 취준생·주니어 마케터. 톤은 직설적이고 실용적, 군더더기 없이.

[지표 해석 기준]
- 도달(reach)이 팔로워 수 대비 낮다 → 훅이 약해 알고리즘이 밀어주지 않은 것(첫 3초 문제).
- 저장(saved)이 낮다 → 실용성·소장 가치 부족(써먹을 게 없음).
- 공유(shares)가 낮다 → 공감·화제성 부족(남에게 보낼 이유 없음).
- 댓글이 낮다 → 참여 유도 장치 부재.
- 좋아요만 있고 저장·공유 없다 → 소비는 됐지만 행동 전환 실패.

[규칙]
- 원인은 추상론 금지. 반드시 이 게시물의 표지 문구를 근거로 구체적으로 짚어라.
- newHeadlines는 '첫 3초 룰'로: 줄당 12자 이내, 숫자 있으면 우선, 추상("~하는 법") 대신 결과·궁금증·의외성. "충격·대박" 류 낚시 금지, 사실 기반.
- fix는 지금 당장 할 수 있는 딱 1가지 액션.

출력 JSON만: {"verdict":"한 줄 총평","causes":["원인1","원인2","원인3"],"fix":"첫 3초에 당장 할 액션 1가지","newHeadlines":["새 표지안1","2","3","4","5"]}`

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId } = await req.json().catch(() => ({}))
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const sb = createAdminClient()
  const [{ data: card }, { data: insight }, { data: snap }] = await Promise.all([
    sb.from("cardnews").select("slides, ig_post_id").eq("article_id", articleId).single(),
    sb.from("insights").select("hook, category").eq("article_id", articleId).single(),
    sb.from("follower_snapshots").select("followers").eq("platform", "instagram").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!card?.ig_post_id) {
    return NextResponse.json({ error: "아직 인스타에 발행되지 않았습니다. 발행 후 지표가 쌓이면 진단할 수 있어요." }, { status: 400 })
  }

  const stats = await getMediaInsight(card.ig_post_id)
  if (!stats) {
    return NextResponse.json({ error: "인스타 지표를 가져오지 못했습니다 (게시물 삭제 또는 지표 미지원)" }, { status: 502 })
  }

  const slides = (card.slides ?? []) as Slide[]
  const cover = slides.find(s => s.type === "cover") as { headline?: string[]; sub?: string } | undefined
  const coverText = cover?.headline?.join(" ") ?? insight?.hook ?? ""
  const followers = snap?.followers ?? null

  const prompt = `[게시물]
표지 헤드라인: ${coverText}
서브: ${cover?.sub ?? "-"}
카테고리: ${insight?.category ?? "-"}
원본 훅: ${insight?.hook ?? "-"}

[성과 지표]
${followers != null ? `현재 팔로워: ${followers}\n` : ""}도달: ${stats.reach}
좋아요: ${stats.likes}
저장: ${stats.saved}
공유: ${stats.shares}
댓글: ${stats.comments}

이 게시물을 진단하라. JSON만 반환.`

  const result = await geminiJson<{ verdict: string; causes: string[]; fix: string; newHeadlines: string[] }>(SYSTEM, prompt, 2000)
  if (!result?.causes?.length) return NextResponse.json({ error: "진단 생성 실패" }, { status: 500 })

  return NextResponse.json({ stats, followers, coverText, ...result })
}
