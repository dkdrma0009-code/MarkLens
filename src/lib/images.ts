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
