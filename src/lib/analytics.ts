// GA4 이벤트 전송 헬퍼 — window.gtag(layout.tsx에서 로드)가 있을 때만 호출.
// SSR·미로드·차단 환경에서 에러 없이 무시. 개인정보(이메일 등)는 절대 전송하지 않는다.
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params ?? {})
  }
}
