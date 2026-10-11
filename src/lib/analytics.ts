export const INTERNAL_COOKIE = "marklens_internal"
let deploymentEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (command: string, eventName: string | Date, params?: Record<string, unknown>) => void
  }
}

export function isAudienceMeasurementAllowed({ hostname, pathname, cookie, production, deployment }: {
  hostname: string; pathname: string; cookie: string; production: boolean; deployment?: string
}): boolean {
  return production && (!deployment || deployment === "production") && hostname === "marklens.site"
    && pathname !== "/login" && !pathname.startsWith("/login/")
    && pathname !== "/admin" && !pathname.startsWith("/admin/")
    && !pathname.startsWith("/auth/") && !pathname.startsWith("/api/")
    && !cookie.split(";").some(value => value.trim() === `${INTERNAL_COOKIE}=1`)
}

export function canTrack(): boolean {
  return typeof window !== "undefined" && isAudienceMeasurementAllowed({
    hostname: window.location.hostname, pathname: window.location.pathname, cookie: document.cookie,
    production: process.env.NODE_ENV === "production", deployment: deploymentEnvironment,
  })
}

// Only campaign identifiers survive; auth tokens and form/search values never enter GA URLs.
export function measurementUrl(raw: string): string {
  const url = new URL(raw)
  const safe = new URL(url.pathname, url.origin)
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = url.searchParams.get(key)
    if (value && /^[a-z0-9_-]{1,80}$/.test(value)) safe.searchParams.set(key, value)
  }
  return safe.href
}

let initialized = false
let previousPage = ""
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-9NCMJC4V6L"

export function measurePage(deployment?: string): void {
  if (typeof window === "undefined") return
  if (deployment !== undefined) deploymentEnvironment = deployment
  // SDK automatic engagement must also stop on excluded SPA routes, before React effects.
  if (!Object.getOwnPropertyDescriptor(window, `ga-disable-${GA_ID}`)) {
    Object.defineProperty(window, `ga-disable-${GA_ID}`, { get: () => !canTrack(), configurable: true })
  }
  if (!canTrack()) { previousPage = ""; return }
  const page = measurementUrl(window.location.href)
  if (!initialized) {
    window.dataLayer = window.dataLayer || []
    window.gtag = (command, name, params) => {
      if (canTrack()) window.dataLayer!.push([command, name, params])
    }
    window.gtag("js", new Date())
    window.gtag("config", GA_ID, { send_page_view: false, page_location: page,
      page_referrer: document.referrer ? measurementUrl(document.referrer) : "" })
    const script = document.createElement("script")
    script.id = "marklens-ga4"
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
    document.head.appendChild(script)
    initialized = true
  }
  if (previousPage === page) return
  const referrer = previousPage || (document.referrer ? measurementUrl(document.referrer) : "")
  previousPage = page
  window.gtag?.("config", GA_ID, { send_page_view: false, page_location: page, page_referrer: referrer })
  window.gtag?.("event", "page_view", { page_location: page, page_referrer: referrer, page_title: document.title })
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!canTrack()) return
  measurePage()
  const safe: Record<string, unknown> = { page_location: measurementUrl(window.location.href) }
  for (const key of ["location", "position"]) {
    const value = params?.[key]
    if (typeof value === "string" && /^[a-z0-9_-]{1,80}$/.test(value)) safe[key] = value
  }
  window.gtag?.("event", name, safe)
}
