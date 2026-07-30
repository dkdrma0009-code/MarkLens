import { createAdminClient } from "@/lib/supabase/admin"
import { generateCuration } from "@/lib/cardnews/curation-generate"
import { publishCuration } from "@/lib/cardnews/curation-publish"
import { NextResponse } from "next/server"

export const maxDuration = 300

// 매주(주간 리듬): 주간 트렌드 큐레이션을 생성·저장한다. 발행은 게이트가 켜졌을 때만.
// - 생성·저장은 항상 수행 → curations 테이블에서 사람이 검토 가능.
// - 발행(라이브 IG 게시)은 app_config.curation_auto_publish === "on" 일 때만.
//   cardnews 의 ig_auto_publish 와 대칭 패턴. 기본 off — 예기치 않은 게시 방지.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const result: Record<string, unknown> = {}

  // 1) 생성 (selectLatest 5개 → LLM 다듬기 → 7장 조립 + 캡션)
  const { curation, warnings } = await generateCuration(supabase)
  if (!curation) {
    return NextResponse.json({ ...result, curation: "생성 실패", warnings })
  }
  result.warnings = warnings

  // 2) 저장 — 발행 여부와 무관하게 항상. 검토·재발행의 근거가 된다.
  const weekOf = curation.weekOf ?? new Date().toISOString().slice(0, 10)
  const { data: saved, error: insErr } = await supabase
    .from("curations")
    .insert({ kind: curation.kind, week_of: weekOf, slides: curation.slides, caption: curation.caption ?? null })
    .select("id")
    .single()
  if (insErr || !saved) {
    return NextResponse.json({ ...result, error: `저장 실패: ${insErr?.message}` }, { status: 500 })
  }
  result.curationId = saved.id

  // 3) 발행 게이트 — off 면 생성·저장까지만(기본값).
  const { data: flag } = await supabase.from("app_config").select("value").eq("key", "curation_auto_publish").single()
  if (flag?.value !== "on") {
    return NextResponse.json({ ...result, published: false, note: "curation_auto_publish off — 생성·저장만" })
  }

  // 4) 발행 (게이트 on)
  try {
    const postId = await publishCuration(saved.id)
    return NextResponse.json({ ...result, published: true, postId })
  } catch (e) {
    return NextResponse.json({ ...result, published: false, publishError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
