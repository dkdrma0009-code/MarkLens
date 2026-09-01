import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import legacyRedirects from "@/lib/insights/legacy-redirects.json"

// 옛 한글 슬러그 → 새 ASCII 슬러그 (Phase 2 마이그레이션 산출물, published 480건)
const legacyMap = legacyRedirects as Record<string, string>

const isAscii = (s: string) => [...s].every((c) => c.charCodeAt(0) < 128)

// 인사이트/OG 옛 URL 을 새 ASCII 로 301 리다이렉트. auth 블록보다 먼저 처리해 조기 반환한다
// (여기서 getUser() 를 타면 매 요청 Auth 호출 + 캐시 방지 헤더로 ISR 이 무력화되므로).
function handleLegacyRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  const m = pathname.match(/^\/(insights|api\/og)\/(.+)$/)
  if (!m) return null

  const prefix = m[1]
  let slug: string
  try {
    slug = decodeURIComponent(m[2])
  } catch {
    slug = m[2]
  }

  const target = legacyMap[slug]
  if (target) {
    const url = request.nextUrl.clone()
    url.pathname = `/${prefix}/${target}`
    return NextResponse.redirect(url, 301)
  }

  // 안전망: 매핑에 없어도 비-ASCII(한글) /insights 슬러그면 ISR 라우트에 도달시키지 않는다.
  // 한글 pathname 이 x-next-cache-tags(Latin1) 헤더를 깨 500 이 재발하기 때문. published 한글
  // URL 은 전부 map 에 있으므로 여기 걸리는 건 draft/오타 등 인덱싱 안 된 URL 뿐 → 인덱스로.
  if (prefix === "insights" && !isAscii(slug)) {
    const url = request.nextUrl.clone()
    url.pathname = "/insights"
    return NextResponse.redirect(url, 308)
  }

  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1) 레거시 슬러그 리다이렉트 (인사이트/OG) — auth 이전, 빠르게 반환
  const legacy = handleLegacyRedirect(request)
  if (legacy) return legacy
  // 리다이렉트 대상이 아닌 인사이트/OG 요청은 auth 불필요 → 통과 (ISR 캐시 보존)
  if (pathname.startsWith("/insights") || pathname.startsWith("/api/og")) {
    return NextResponse.next()
  }

  // 크론/웹훅이 시크릿으로 호출하는 카드뉴스 생성은 세션 미들웨어를 건너뛴다.
  // (라우트가 자체적으로 secret === N8N_WEBHOOK_SECRET 를 검증한다. 이 예외가 없으면
  //  ig-daily 드립의 cardnews 생성이 미들웨어 401 에 막혀 자동발행이 통째로 실패한다.)
  const secret = request.nextUrl.searchParams.get("secret")
  if (pathname === "/api/admin/cardnews/generate" && secret && secret === process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.next()
  }

  // 2) 관리자 auth (기존 로직) — /admin, /api/admin 만
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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/insights/:path*", "/api/og/:path*"],
}
