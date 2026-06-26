import { createAdminClient } from "@/lib/supabase/admin"
import { generateUnsubscribeUrl } from "@/app/api/unsubscribe/route"

// 온보딩 드립 시퀀스 — 구독 확인(웰컴=step0) 후 며칠에 걸쳐 활성화 메일을 보낸다.
// subscribers.drip_step으로 진행 추적(0=웰컴만, 1·2=각 단계 발송 완료). 신규만 대상(기존은 99).
// cron/collect(매일)에서 호출. drip_step 컬럼이 없으면(마이그레이션 전) graceful no-op.

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"

type DripStep = {
  step: number
  afterDays: number
  subject: string
  body: string // 본문 HTML (래퍼는 wrap()이 감쌈)
}

// 각 단계 본문. 브랜드 보이스(에디토리얼, 취준생·주니어 타깃), 도구로 활성화 유도.
const STEPS: DripStep[] = [
  {
    step: 1,
    afterDays: 2,
    subject: "MarkLens, 이렇게 쓰면 200% 뽑아요",
    body: `
      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.8;">
        구독하고 며칠 지났어요. 월요일 메일만 기다리기엔 아까운 게 더 있어서요.
      </p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">지금 바로 해볼 것</p>
      <p style="margin:0 0 6px;font-size:14px;color:#444;line-height:1.7;">📚 지난 인사이트 아카이브 — 관심 카테고리부터 골라 읽기</p>
      <p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.7;">🔖 마음에 드는 글은 포트폴리오·면접 답변 소재로 메모해 두기</p>
      <div style="text-align:center;margin-top:8px;">
        <a href="${SITE}/insights" style="display:inline-block;padding:13px 30px;background:#0d0d0d;color:#fff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;">인사이트 둘러보기 →</a>
      </div>`,
  },
  {
    step: 2,
    afterDays: 4,
    subject: "트렌드를 '면접 답변'으로 바꾸는 연습장",
    body: `
      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.8;">
        MarkLens는 읽고 끝이 아니에요. 트렌드를 <b>실무·면접 무기</b>로 바꾸는 도구가 있어요.
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#444;line-height:1.7;">🧠 <b>인사이트 랩</b> — 뻔한 분석을 '한 번 꺾는' 사고 훈련</p>
      <p style="margin:0 0 4px;font-size:14px;color:#444;line-height:1.7;">🎤 <b>면접 연습</b> — 트렌드 기반 질문에 답해보고 피드백 받기</p>
      <p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.7;">✅ <b>퀴즈</b> — 이번 주 마케팅 상식 체크</p>
      <div style="text-align:center;margin-top:8px;">
        <a href="${SITE}/insight-lab" style="display:inline-block;padding:13px 30px;background:#6366f1;color:#fff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;">인사이트 랩 시작 →</a>
      </div>
      <div style="text-align:center;margin-top:10px;">
        <a href="${SITE}/practice" style="font-size:13px;color:#6366f1;text-decoration:none;">면접 연습·퀴즈 보러 가기 →</a>
      </div>`,
  },
]

function wrap(body: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:40px 20px;background:#e8e5e0;${F}">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
    <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:30px 32px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:800;color:#fff;letter-spacing:0.04em;">MarkLens</p>
    </td></tr>
    <tr><td style="background:#fff;padding:30px 32px;">${body}</td></tr>
    <tr><td style="background:#e8e5e0;border-radius:0 0 16px 16px;border-top:1px solid #d8d5d0;padding:18px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;color:#999;">트렌드를 실전으로 바꾸는 마크렌즈 · marklens.site</p>
      <a href="${unsubscribeUrl}" style="font-size:11px;color:#aaa;text-decoration:underline;">구독 취소</a>
    </td></tr>
  </table></td></tr></table>
</body></html>`
}

async function sendDrip(email: string, step: DripStep): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) return false
  const unsubscribeUrl = await generateUnsubscribeUrl(email)
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "MarkLens", email: "newsletter@marklens.site" },
      to: [{ email }],
      subject: step.subject,
      htmlContent: wrap(step.body, unsubscribeUrl),
    }),
  })
  return res.ok
}

const MAX_STEP = STEPS.length // 이 단계까지 보내면 완료

// 드립 한 사이클 실행 — 활성 구독자 중 다음 단계가 도래한 사람에게 1통씩 발송하고 drip_step 전진.
export async function runOnboardingDrip(): Promise<{ sent: number; skipped?: string }> {
  const sb = createAdminClient()
  const now = Date.now()

  // 미완료(드립 진행 중) 활성 구독자만. 컬럼 없으면 에러 → graceful no-op.
  const { data: subs, error } = await sb
    .from("subscribers")
    .select("email, subscribed_at, drip_step")
    .eq("status", "active")
    .lt("drip_step", MAX_STEP)
    .gte("drip_step", 0)
    .limit(200)

  if (error) return { sent: 0, skipped: `drip 비활성(${error.message})` } // 마이그레이션 전 등

  let sent = 0
  for (const s of subs ?? []) {
    const nextStep = (s.drip_step ?? 0) + 1
    const def = STEPS.find(x => x.step === nextStep)
    if (!def || !s.subscribed_at) continue
    const days = (now - new Date(s.subscribed_at).getTime()) / 86_400_000
    if (days < def.afterDays) continue // 아직 도래 안 함

    const ok = await sendDrip(s.email, def).catch(() => false)
    if (ok) {
      await sb.from("subscribers").update({ drip_step: nextStep }).eq("email", s.email)
      sent++
    }
  }
  return { sent }
}
