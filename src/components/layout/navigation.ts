// Public menu (header and mobile menu). `section` lists the routes that belong to an item besides its own href:
// Career Lab is the hub of Insight Lab, AI Interview and the trend quiz, which live at their own top-level paths.
export const PUBLIC_NAV_ITEMS = [
  { href: "/insights", label: "Insights" },
  { href: "/#signals", label: "Trends" },
  { href: "/brands", label: "Brand Watch" },
  { href: "/#collections", label: "Collections" },
  { href: "/practice", label: "Career Lab", section: ["/learn", "/interview", "/insight-lab"] },
  { href: "/glossary", label: "Dictionary" },
  { href: "/newsletter", label: "Weekly" },
]

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`)

// aria-current for an item: "page" on its own page, "true" inside its section, "location" for the home anchor in view.
export function navCurrent(item: { href: string; section?: string[] }, pathname: string, hash: string): "page" | "true" | "location" | undefined {
  if (item.href.includes("#")) return pathname === "/" && hash === item.href.slice(1) ? "location" : undefined
  if (pathname === item.href) return "page"
  return [item.href, ...(item.section ?? [])].some(route => within(pathname, route)) ? "true" : undefined
}
