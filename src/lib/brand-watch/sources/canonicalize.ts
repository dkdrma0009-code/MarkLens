import type { SourceProvider } from "./types"

export function canonicalizeSourceUrl(input: string, policy?: SourceProvider["urlPolicy"]): string {
  const url = new URL(input)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid source URL")
  url.hash = ""
  const equivalent = policy?.equivalentHosts.map(host => host.toLowerCase()) ?? []
  if (equivalent.includes(url.hostname)) url.hostname = equivalent[0]
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|dclid|msclkid|igshid)$/i.test(key) || policy?.removeQueryKeys.includes(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  if (policy?.trailingSlash === "remove" && url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "")
  return url.toString()
}

export function assertProviderUrl(input: string, provider: SourceProvider): URL {
  const url = new URL(input)
  if (url.protocol !== "https:" || url.hostname !== provider.domain.toLowerCase() || url.port || url.username || url.password) throw new Error("DOMAIN_ESCAPE")
  return url
}
