import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 응답 객체를 미리 생성 — setAll에서 쿠키/헤더를 여기에 기록
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // @supabase/ssr 0.10.x: 두 번째 인자 headers — CDN 캐시 방지 헤더
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  // getUser()는 Auth 서버에서 토큰을 검증 (getSession보다 안전)
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  const userEmail = (user?.email ?? "").trim().toLowerCase()
  const isAdmin = !!user && userEmail === adminEmail

  if (!isAdmin) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
