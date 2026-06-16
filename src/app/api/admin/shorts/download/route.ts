import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// Lambda가 완료되면 outputFile(S3 presigned URL)에서 파일을 받아 클라이언트로 전달.
// S3 presigned URL을 직접 클라이언트에 노출하지 않기 위해 프록시.
export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const outputFile = searchParams.get("outputFile")
  const slug = searchParams.get("slug") ?? "shorts"

  if (!outputFile) return NextResponse.json({ error: "outputFile 필요" }, { status: 400 })

  const res = await fetch(outputFile)
  if (!res.ok) return NextResponse.json({ error: "S3 파일 수령 실패" }, { status: 502 })

  const buf = await res.arrayBuffer()
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="shorts-${slug}.mp4"`,
    },
  })
}
