import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { CompetitionStatus } from "@/types"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

const VALID_STATUS: CompetitionStatus[] = ["pending", "published", "rejected", "expired"]

// 게시·반려 등 status 변경 + 인라인 필드 수정 (기존 articles 패턴)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "잘못된 status" }, { status: 400 })
    }
    patch.status = body.status
  }
  // 인라인 수정 허용 필드
  for (const k of ["title", "organizer", "description", "category", "deadline", "difficulty", "prize", "eligibility"]) {
    if (k in body) patch[k] = body[k]
  }
  if (Array.isArray(body.job_fit)) patch.job_fit = body.job_fit
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("competitions").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from("competitions").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
