import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/api-auth"
import { resolveCardnewsPublish } from "@/lib/cardnews/publish"

// 발행 확인 필요(needs_review 또는 15분 넘게 멈춘 publishing) 복구 — 관리자가 플랫폼에서 직접 확인한 결과를 기록한다.
// action "published": 게시 확인, postId 기록 / "release": 게시 안 됨 확인 → failed(재시도 가능)
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { articleId, channel, action, postId } = await req.json().catch(() => ({}))
  if (!articleId || !["instagram", "threads"].includes(channel) || !["published", "release"].includes(action)) {
    return NextResponse.json({ error: "articleId, channel(instagram|threads), action(published|release) required" }, { status: 400 })
  }
  try {
    await resolveCardnewsPublish(articleId, channel, action, typeof postId === "string" ? postId : undefined)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "상태 기록 실패" }, { status: 409 })
  }
}
