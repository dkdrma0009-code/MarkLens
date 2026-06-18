export type InsightDifficulty = '쉬움' | '보통' | '어려움'
export type InsightTab = 'challenge' | 'free' | 'notes' | 'report'

export interface InsightChallenge {
  id: string
  title: string
  summary: string
  category: string
  difficulty: InsightDifficulty
  source_url?: string
  source_name?: string
  published_date: string
  active: boolean
  created_at: string
}

export interface InsightScores {
  // 핵심 2축 (상단 노출)
  cliche: number   // 진부함 1-5, 낮을수록 좋음
  pivot: number    // 꺾임 1-5, 높을수록 좋음
  // 보조 4축
  observation: number  // 관찰력 0-100
  analysis: number     // 분석력 0-100
  insight: number      // 인사이트력 0-100
  strategy: number     // 전략력 0-100
}

export interface InsightFeedback {
  scores: InsightScores
  pivotJudgment: string    // "직선입니다" or "꺾였습니다"
  clicheReason: string     // 진부함 이유
  reframeQuestion: string  // 어디서 꺾었어야 했나 (질문으로만)
  // 꺾기 기법 사전 — 실존 수상작 인용 없이 기법 원리로 안내
  techniqueName: string    // 권장 기법명
  techniqueExplanation: string  // 기법 원리 2-3문장
  techniqueExample: string      // 이 케이스에 적용한 가상 예시 (실존 작품 아님)
  clicheWords: string[]    // 뻔한 단어 목록
  comments: {
    observation: string
    analysis: string
    insight: string
    strategy: string
  }
  summary: string
  tips: string[]
  xp: number
}

export interface AnalysisAnswers {
  step1: string        // 현상 관찰
  step2: string        // 원인 분석
  step3: string        // 숨은 욕구
  step4: string        // 핵심 인사이트 (첫 버전)
  linearAnswer: string // 직선 답 (꺾기 전)
  reframedInsight: string // 꺾은 인사이트
  step5: string        // 브랜드 기회
}

export interface InsightSession {
  id: string
  user_id: string
  challenge_id?: string
  custom_article_text?: string
  step1_observation: string
  step2_cause: string
  step3_desire: string
  step4_insight: string
  step5_opportunity: string
  score_observation?: number
  score_analysis?: number
  score_insight?: number
  score_strategy?: number
  ai_feedback?: InsightFeedback
  xp_earned: number
  created_at: string
}

export interface InsightNote {
  id: string
  user_id: string
  title: string
  observation: string
  cause: string
  desire: string
  insight: string
  opportunity: string
  tags: string[]
  category: string
  source_label: string
  created_at: string
  updated_at: string
}

export interface InsightUserStats {
  user_id: string
  total_sessions: number
  total_xp: number
  streak_days: number
  last_activity_date?: string
  avg_score_observation: number
  avg_score_analysis: number
  avg_score_insight: number
  avg_score_strategy: number
  updated_at: string
}

// XP → 레벨 변환
const XP_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4200, 5500]
const LEVEL_NAMES = ['견습생', '탐구자', '분석가', '인사이터', '전략가', '마스터', '챔피언', '레전드', '구루', 'MarkLens']

export function getLevel(xp: number) {
  let level = 1
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }
  level = Math.min(level, XP_THRESHOLDS.length)
  const current = XP_THRESHOLDS[level - 1] ?? 0
  const next = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
  return {
    level,
    name: LEVEL_NAMES[level - 1] ?? LEVEL_NAMES[LEVEL_NAMES.length - 1],
    current,
    next,
    progress: next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100),
  }
}

export function calcXP(scores: InsightScores): number {
  // 꺾임 점수(1-5)와 진부함 역점수를 XP에 반영
  const pivotBonus = (scores.pivot - 1) * 10   // 0~40 bonus
  const clichePenalty = (scores.cliche - 1) * 5 // 0~20 penalty
  const auxAvg = (scores.observation + scores.analysis + scores.insight + scores.strategy) / 4
  return Math.round(Math.max(10, 30 + (auxAvg / 100) * 40 + pivotBonus - clichePenalty))
}
