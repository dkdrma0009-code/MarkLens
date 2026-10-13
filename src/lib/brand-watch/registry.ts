import { entitySchema, normalizeAlias } from "./schemas"

// Deterministic seed definitions; importing this file never writes to a database.
export const launchRegistry = [
  { slug: "musinsa", name: "MUSINSA", nameKo: "무신사", category: "fashion", aliases: ["MUSINSA", "무신사"], coreScopes: ["Store", "Global", "Beauty"], separateCandidates: ["29CM: related_brand", "Musinsa Standard: sub_brand_of"], excludedTopics: [] },
  { slug: "olive-young", name: "OLIVE YOUNG", nameKo: "올리브영", category: "beauty", aliases: ["OLIVE YOUNG", "올리브영", "올리브 영"], coreScopes: ["retail", "app", "global", "N Seongsu"], separateCandidates: ["PB brands: separate entity review"], excludedTopics: [] },
  { slug: "toss", name: "TOSS", nameKo: "토스", category: "finance", aliases: ["TOSS", "토스"], coreScopes: ["core app"], separateCandidates: ["Toss Bank", "Toss Securities", "Toss Place"], excludedTopics: [] },
  { slug: "baemin", name: "BAEMIN", nameKo: "배달의민족", category: "delivery", aliases: ["BAEMIN", "배달의민족", "배민"], coreScopes: ["core service"], separateCandidates: ["Bmart: service_of", "Baemin Store: service_of", "Pickup: service_of", "Club: service_of"], excludedTopics: ["Woowa corporate-only"] },
  { slug: "danggeun", name: "DANGGEUN", nameKo: "당근", category: "local", aliases: ["DANGGEUN", "DAANGN", "당근", "당근마켓"], coreScopes: ["core local service"], separateCandidates: ["major service extensions: service_of"], excludedTopics: ["corporate-only", "hiring-only"] },
].map((entry, index) => ({
  ...entry,
  entity: entitySchema.parse({ id: `b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, slug: entry.slug, name: entry.name, nameKo: entry.nameKo, entityType: "brand", category: entry.category, subcategory: null, description: null, status: "active" }),
}))

const aliasOwners = new Map<string, string>()
for (const entry of launchRegistry) for (const alias of entry.aliases) {
  const key = normalizeAlias(alias)
  if (aliasOwners.has(key)) throw new Error(`Duplicate launch alias: ${key}`)
  aliasOwners.set(key, entry.slug)
}
export function resolveLaunchAlias(alias: string): string | undefined {
  return aliasOwners.get(normalizeAlias(alias))
}
