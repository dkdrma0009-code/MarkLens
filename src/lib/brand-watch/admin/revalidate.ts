import { launchRegistry } from "../registry"

// Targeted public revalidation after a successful review command. Only commands that can change what the public
// pages show are listed (publish, approve-to-publish, merge/supersede of published facts, Evidence correction).
// Rejecting drafts or approving pending Evidence changes nothing public, so it never revalidates.
const TARGETS: Record<string, { table: string; key: string }> = {
  "evidence.supersede": { table: "brand_evidence", key: "evidenceId" },
  "movement.approve": { table: "brand_movements", key: "movementId" },
  "movement.supersede": { table: "brand_movements", key: "movementId" },
  "movement.merge": { table: "brand_movements", key: "sourceMovementId" },
  "pattern.publish": { table: "brand_patterns", key: "patternId" },
  "take.publish": { table: "brand_takes", key: "takeId" },
  "snapshot.publish": { table: "brand_snapshots", key: "snapshotId" },
}

export interface RevalidationQueryClient {
  from(table: string): { select(columns: string): { in(column: string, values: readonly string[]): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } }
}

export function publicRevalidationTarget(command: Record<string, unknown>) {
  const target = TARGETS[String(command.command)]
  const id = target && command[target.key]
  return target && typeof id === "string" ? { table: target.table, id } : null
}

// Returns the paths it revalidated: the Brand Watch index and the affected launch brand's page only.
export async function revalidateBrandWatchPublic(client: RevalidationQueryClient, command: Record<string, unknown>, revalidate: (path: string) => void): Promise<string[]> {
  const target = publicRevalidationTarget(command)
  if (!target) return []
  const row = await client.from(target.table).select("entity_id").in("id", [target.id])
  const entityId = (row.data?.[0] as { entity_id?: string } | undefined)?.entity_id
  if (row.error || !entityId) return []
  const entity = await client.from("brand_entities").select("slug").in("id", [entityId])
  const slug = (entity.data?.[0] as { slug?: string } | undefined)?.slug
  const paths = ["/brands", ...(slug && launchRegistry.some(entry => entry.slug === slug) ? [`/brands/${slug}`] : [])]
  for (const path of paths) revalidate(path)
  return paths
}
