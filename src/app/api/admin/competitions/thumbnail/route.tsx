import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { loadFonts } from "@/lib/cardnews/fonts"
import { ddayLabel, computePriority } from "@/lib/competitions/priority"
import type { Competition } from "@/types"

export const maxDuration = 60

// 공모전 텍스트 썸네일 — 원본 이미지 호스팅 금지 정책. Satori로 제목·주최·D-day 기반 카드 생성.
// 기존 cardnews/shorts 렌더(ImageResponse + loadFonts) 인프라 재사용.
async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

const PRIORITY_COLOR: Record<string, string> = {
  red: "#ef4444", orange: "#f59e0b", yellow: "#eab308", green: "#10b981",
}

export async function GET(req: Request) {
  if (!await isAuthorized(req)) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return new Response("id required", { status: 400 })

  const supabase = createAdminClient()
  const { data } = await supabase.from("competitions").select("*").eq("id", id).single()
  if (!data) return new Response("not found", { status: 404 })
  const c = data as Competition

  const dday = ddayLabel(c.deadline)
  const priority = computePriority(c.deadline, c.difficulty)
  const accent = PRIORITY_COLOR[priority] ?? "#eab308"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", backgroundColor: "#0a0a0a", color: "#fff",
          padding: 64, fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, color: "#9ca3af" }}>{c.category ?? "공모전"}</span>
          <span style={{ fontSize: 40, fontWeight: 700, color: accent }}>{dday}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.25, letterSpacing: -1 }}>
            {c.title.slice(0, 50)}
          </div>
          {c.organizer && (
            <div style={{ fontSize: 32, color: "#9ca3af", marginTop: 24 }}>{c.organizer}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {(c.job_fit ?? []).slice(0, 3).map((j, i) => (
              <span key={i} style={{ fontSize: 24, color: "#d1d5db", border: "1px solid #374151", borderRadius: 100, padding: "6px 18px" }}>
                {j}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#6b7280" }}>MarkLens</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await loadFonts() }
  )
}
