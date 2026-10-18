// Career Lab's tools: official English names with a Korean description, in Career Lab's order (01–03). URLs are fixed.
export const CAREER_FEATURES = [
  { href: "/insight-lab", name: "Insight Lab", description: "인사이트 분석 훈련" },
  { href: "/interview", name: "AI Interview", description: "AI 모의면접" },
  { href: "/learn", name: "Trend Quiz", description: "트렌드 퀴즈" },
]

// Public menu (header and mobile menu). Home is the wordmark; its Signals and Collections sections are reached from
// Home, not from the menu. `section` lists the routes that belong to an item besides its own href: Career Lab is the
// hub of its tools, which live at their own top-level paths.
export const PUBLIC_NAV_ITEMS = [
  { href: "/insights", label: "Insights" },
  { href: "/brands", label: "Brand Watch" },
  { href: "/practice", label: "Career Lab", section: CAREER_FEATURES.map(feature => feature.href) },
  { href: "/glossary", label: "Dictionary" },
  { href: "/newsletter", label: "Weekly" },
]

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`)

// aria-current for an item: "page" on its own page, "true" inside its section.
export function navCurrent(item: { href: string; section?: string[] }, pathname: string): "page" | "true" | undefined {
  if (pathname === item.href) return "page"
  return [item.href, ...(item.section ?? [])].some(route => within(pathname, route)) ? "true" : undefined
}
