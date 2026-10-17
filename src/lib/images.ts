// 이미지 핫링크 차단 매체 + weserv 프록시 헬퍼 (collect·썸네일 공통)

// 외부 직접 로드를 거부하는 매체 — 기술적 차단을 프록시로 우회하지 않는다(저작권 존중).
// 이 목록의 이미지는 프록시 없이 폴백 처리한다.
export const HOTLINK_BLOCKED_DOMAINS = ["cdn.musebyclios.com", "musebyclios.com"]

export function isHotlinkBlocked(url?: string | null): boolean {
  if (!url) return false
  return HOTLINK_BLOCKED_DOMAINS.some(d => url.includes(d))
}

// weserv 프록시 — 성능 최적화(리사이즈·webp·CDN 캐시) 용도. 차단 우회 용도 아님.
// 차단 매체는 호출 전에 isHotlinkBlocked로 걸러야 한다.
export function weservThumb(url: string, width = 440): string {
  const stripped = url.replace(/^https?:\/\//, "")
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&output=webp&q=75&maxage=7d`
}

// Public images use the CDN as the only transformer (next.config images.unoptimized is global, so this
// builds the src explicitly). Preserve source query parameters (including signed URLs); unwrap our existing
// CDN URL once so an already-proxied URL is never proxied twice.
export function editorialImageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const url = new URL(src, "https://marklens.site")
  const original = (url.hostname === "images.weserv.nl" || url.hostname === "wsrv.nl")
    ? url.searchParams.get("url") || src : src
  return weservThumb(original, width)
}

// Widths the browser may pick from (srcset). Every candidate is a CDN URL; Vercel never resizes.
export const CDN_WIDTHS = [320, 480, 640, 768, 1024, 1440, 1920, 2560] as const
export function editorialSrcSet(src: string, widths: readonly number[] = CDN_WIDTHS): string {
  return widths.map(width => `${editorialImageLoader({ src, width })} ${width}w`).join(", ")
}
