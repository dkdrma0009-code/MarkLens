import type { SupabaseClient } from "@supabase/supabase-js"
import type { SourceItemInsert, SourceRepository } from "./persist"
import type { StoredSourceIdentity } from "./dedup"

type IdentityRow = { id: string; provider_id: string; canonical_url: string; content_hash: string }
const select = "id,provider_id,canonical_url,content_hash"
const identity = (row: IdentityRow): StoredSourceIdentity => ({ id: row.id, providerId: row.provider_id, canonicalUrl: row.canonical_url, contentHash: row.content_hash })

// Explicitly injected service-role client: no env loading, client creation or writes on import.
// This phase uses only mocks/local PostgreSQL. No route/cron instantiates this repository.
export function createSourceRepository(client: SupabaseClient): SourceRepository {
  return {
    async related(canonicalUrl, contentHash) {
      const [byUrl, byHash] = await Promise.all([
        client.from("source_items").select(select).eq("canonical_url", canonicalUrl).limit(100),
        client.from("source_items").select(select).eq("content_hash", contentHash).limit(100),
      ])
      if (byUrl.error || byHash.error) throw new Error("SOURCE_LOOKUP_FAILED")
      return [...new Map([...byUrl.data ?? [], ...byHash.data ?? []].map(row => [row.id, identity(row)])).values()]
    },
    async insertIfAbsent(row: SourceItemInsert) {
      const result = await client.from("source_items").insert(row).select(select).single()
      if (!result.error) return { identity: identity(result.data), inserted: true }
      if (result.error.code !== "23505") throw new Error("SOURCE_INSERT_FAILED")
      const existing = await client.from("source_items").select(select).eq("canonical_url", row.canonical_url).eq("content_hash", row.content_hash).single()
      if (existing.error || !existing.data) throw new Error("SOURCE_CONFLICT_LOOKUP_FAILED")
      return { identity: identity(existing.data), inserted: false }
    },
  }
}
