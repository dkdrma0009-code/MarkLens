import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 30

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드 필수" }, { status: 400 })
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "jpeg/png/webp만 가능" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "5MB 이하만 가능" }, { status: 400 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const sb = createAdminClient()
  const { error } = await sb.storage
    .from("ad-assets")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = sb.storage.from("ad-assets").getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
