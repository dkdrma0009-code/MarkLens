import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateText } from "@/lib/ai/llm"
import { calcXP } from "@/types/insight-lab"
import { getTechniquesForPrompt } from "@/lib/insight-lab/techniques"
import type { InsightFeedback, InsightScores } from "@/types/insight-lab"

function buildJudgeSystem(): string {
  return `당신은 마케팅 공모전 본선 심사위원입니다. 칭찬이 아니라 '직선/꺾기'를 가려내는 게 임무입니다.

직선의 정의: 문제→해결이 곧장 이어지면 진부합니다.
예) 탐색이 피곤하다→추천 강화 / 시간이 없다→빠르게 / 인지도가 낮다→광고 확대
꺾기의 정의: 문제와 해결 사이에서 한 번 꺾어 '판'을 옮기는 것. 문제가 생기는 상황 자체를 다른 곳으로 이동시킨다.

평가 기준:
- pivot(꺾임 점수, 1-5): 판을 옮겼나. 5=완전히 옮김. 직선이면 1-2.
- cliche(진부함 점수, 1-5): "이 답을 떠올릴 사람이 몇 %일까" 관점. 5=누구나 생각함. 1-2=독창적.
- observation(관찰력, 0-100): 현상을 구체적·정확하게 포착했는가.
- analysis(분석력, 0-100): 원인을 논리적·깊이 있게 분석했는가.
- insight(인사이트력, 0-100): 핵심 인사이트가 날카롭고 독창적인가.
- strategy(전략력, 0-100): 브랜드 기회가 구체적이고 실행 가능한가.

활용 가능한 꺾기 기법 사전 (techniqueId → 이름 · 트리거):
${getTechniquesForPrompt()}

출력 규칙:
- JSON 형식으로만 응답. 다른 텍스트 절대 포함 금지.
- techniqueExample 필드: 반드시 "이렇게 꺾을 수도 있습니다(가상 예시)"로 표기. 실존 캠페인/수상작 내용을 사실처럼 서술 금지. 특정 브랜드 실제 사례를 지어내는 것 금지.
- 막연한 칭찬("좋네요") 금지. 직선이면 "아직 직선입니다"라고 단언.
- reframeQuestion: 정답을 주지 말고, 질문으로만 제시.

{
  "scores": { "pivot": 2, "cliche": 4, "observation": 70, "analysis": 60, "insight": 45, "strategy": 55 },
  "pivotJudgment": "아직 직선입니다." 또는 "꺾였습니다.",
  "clicheReason": "진부함 이유 1-2문장",
  "reframeQuestion": "어디서 꺾었어야 했나 — 질문으로만",
  "techniqueName": "위 기법 사전에서 이 케이스에 맞는 기법명",
  "techniqueExplanation": "해당 기법의 작동 원리 2-3문장 (일반론, 특정 작품 인용 금지)",
  "techniqueExample": "이 케이스에 기법을 적용한 가상 예시 (실존 사례 아님을 명시)",
  "clicheWords": ["뻔한단어1", "뻔한단어2"],
  "comments": {
    "observation": "관찰력 코멘트",
    "analysis": "분석력 코멘트",
    "insight": "인사이트력 코멘트",
    "strategy": "전략력 코멘트"
  },
  "summary": "심사위원 총평 1-2문장",
  "tips": ["구체적 개선 팁 1", "구체적 개선 팁 2"]
}`
}

function buildPrompt(article: string, answers: Record<string, string>): string {
  return `## 분석 대상 트렌드/기사
${article}

## 사용자 답변
1. 현상 관찰: ${answers.step1 || "(미입력)"}
2. 원인 분석: ${answers.step2 || "(미입력)"}
3. 숨은 욕구: ${answers.step3 || "(미입력)"}
4. 핵심 인사이트 (초안): ${answers.step4 || "(미입력)"}
5. 직선 첫 반응 (꺾기 전): ${answers.linearAnswer || "(미입력)"}
6. 꺾은 인사이트 (직선 차단 후): ${answers.reframedInsight || "(미입력)"}
7. 브랜드 기회: ${answers.step5 || "(미입력)"}`
}

function parseResponse(raw: string): InsightFeedback | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const p = JSON.parse(match[0])
    const scores: InsightScores = {
      pivot: Math.min(5, Math.max(1, Number(p.scores?.pivot ?? 2))),
      cliche: Math.min(5, Math.max(1, Number(p.scores?.cliche ?? 3))),
      observation: Math.min(100, Math.max(0, Number(p.scores?.observation ?? 50))),
      analysis: Math.min(100, Math.max(0, Number(p.scores?.analysis ?? 50))),
      insight: Math.min(100, Math.max(0, Number(p.scores?.insight ?? 50))),
      strategy: Math.min(100, Math.max(0, Number(p.scores?.strategy ?? 50))),
    }
    const xp = calcXP(scores)
    return {
      scores,
      pivotJudgment: String(p.pivotJudgment ?? "판정 없음"),
      clicheReason: String(p.clicheReason ?? ""),
      reframeQuestion: String(p.reframeQuestion ?? ""),
      techniqueName: String(p.techniqueName ?? ""),
      techniqueExplanation: String(p.techniqueExplanation ?? ""),
      techniqueExample: String(p.techniqueExample ?? ""),
      clicheWords: Array.isArray(p.clicheWords) ? p.clicheWords.map(String) : [],
      comments: {
        observation: String(p.comments?.observation ?? ""),
        analysis: String(p.comments?.analysis ?? ""),
        insight: String(p.comments?.insight ?? ""),
        strategy: String(p.comments?.strategy ?? ""),
      },
      summary: String(p.summary ?? ""),
      tips: Array.isArray(p.tips) ? p.tips.map(String) : [],
      xp,
    }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { challengeId, customArticle, answers } = body as {
    challengeId?: string
    customArticle?: string
    answers: Record<string, string>
  }

  if (!answers?.step1) return NextResponse.json({ error: "답변이 없습니다" }, { status: 400 })

  // 길이 제한 (프롬프트 인젝션·토큰 비용 방지)
  if ((customArticle?.length ?? 0) > 3000) return NextResponse.json({ error: "기사가 너무 깁니다 (최대 3000자)" }, { status: 400 })
  const ANSWER_MAX = 500
  for (const key of ["step1","step2","step3","step4","linearAnswer","reframedInsight","step5"] as const) {
    if ((answers[key]?.length ?? 0) > ANSWER_MAX) return NextResponse.json({ error: `답변이 너무 깁니다 (${key}, 최대 ${ANSWER_MAX}자)` }, { status: 400 })
  }

  // 기사 텍스트
  let articleText = customArticle ?? ""
  if (!articleText && challengeId) {
    const { data: ch } = await supabase.from("insight_challenges").select("title, summary").eq("id", challengeId).single()
    if (ch) articleText = `${ch.title}\n\n${ch.summary}`
  }
  if (!articleText) return NextResponse.json({ error: "기사 내용이 없습니다" }, { status: 400 })

  // 심사
  const raw = await generateText({ system: buildJudgeSystem(), prompt: buildPrompt(articleText, answers), maxTokens: 1200 })
  const feedback = parseResponse(raw)
  if (!feedback) return NextResponse.json({ error: "심사 실패 — 다시 시도해주세요" }, { status: 500 })

  // 세션 저장
  const { data: session } = await supabase.from("insight_sessions").insert({
    user_id: user.id,
    challenge_id: challengeId ?? null,
    custom_article_text: customArticle ?? null,
    step1_observation: answers.step1,
    step2_cause: answers.step2 ?? "",
    step3_desire: answers.step3 ?? "",
    step4_insight: answers.step4 ?? "",
    step4_linear: answers.linearAnswer ?? "",
    step4_reframed: answers.reframedInsight ?? "",
    step5_opportunity: answers.step5 ?? "",
    score_cliche: feedback.scores.cliche,
    score_pivot: feedback.scores.pivot,
    score_observation: feedback.scores.observation,
    score_analysis: feedback.scores.analysis,
    score_insight: feedback.scores.insight,
    score_strategy: feedback.scores.strategy,
    ai_feedback: feedback,
    xp_earned: feedback.xp,
  }).select("id").single()

  // 통계 upsert
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const { data: st } = await supabase.from("insight_user_stats").select("*").eq("user_id", user.id).single()
  if (st) {
    const alreadyToday = st.last_activity_date === today
    const n = st.total_sessions + 1
    const newStreak = alreadyToday
      ? st.streak_days
      : st.last_activity_date === yesterday
        ? st.streak_days + 1
        : 1
    // 오늘 이미 제출한 경우 XP 추가 적립 방지
    const xpDelta = alreadyToday ? 0 : feedback.xp
    await supabase.from("insight_user_stats").update({
      total_sessions: n, total_xp: st.total_xp + xpDelta, streak_days: newStreak,
      last_activity_date: today,
      avg_score_observation: ((st.avg_score_observation * (n - 1)) + feedback.scores.observation) / n,
      avg_score_analysis: ((st.avg_score_analysis * (n - 1)) + feedback.scores.analysis) / n,
      avg_score_insight: ((st.avg_score_insight * (n - 1)) + feedback.scores.insight) / n,
      avg_score_strategy: ((st.avg_score_strategy * (n - 1)) + feedback.scores.strategy) / n,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id)
  } else {
    await supabase.from("insight_user_stats").insert({
      user_id: user.id, total_sessions: 1, total_xp: feedback.xp, streak_days: 1,
      last_activity_date: today,
      avg_score_observation: feedback.scores.observation,
      avg_score_analysis: feedback.scores.analysis,
      avg_score_insight: feedback.scores.insight,
      avg_score_strategy: feedback.scores.strategy,
    })
  }

  return NextResponse.json({ feedback, sessionId: session?.id })
}
