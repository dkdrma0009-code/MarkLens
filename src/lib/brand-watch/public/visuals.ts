import { isHotlinkBlocked } from "@/lib/images"
import { launchVisuals, type LaunchVisual } from "../launch/visuals"
import type { PublicSource, PublicVisual } from "./types"

const normalized = (url: string) => { try { return new URL(url).href } catch { return null } }
// Only an https image that the site rules allow to be linked, with a meaningful alt, is usable.
const usable = (entry: LaunchVisual) => normalized(entry.imageUrl)?.startsWith("https://") === true && !isHotlinkBlocked(entry.imageUrl) && entry.alt.trim().length > 0

// Pure: the first usable registry image whose source is one of this Movement's public footnoted sources.
// Sources reach a Movement only through approved, active, primary Evidence, so a rejected, superseded or
// unpublished lineage never yields an image. Review notes (checkedAt, note) are not copied.
export function movementVisual(sourceRefs: readonly number[], sources: readonly PublicSource[], registry: readonly LaunchVisual[] = launchVisuals): PublicVisual | null {
  const candidates = sources.filter(source => sourceRefs.includes(source.ref))
  for (const entry of registry) {
    const target = normalized(entry.sourceUrl)
    const source = target && candidates.find(row => normalized(row.url) === target)
    if (source && usable(entry)) return { src: entry.imageUrl, alt: entry.alt.trim(), sourceRef: source.ref, provider: source.provider, origin: entry.origin, credit: entry.credit, fit: entry.fit ?? "cover", focus: entry.focus ?? "center", delivery: entry.delivery ?? "cdn" }
  }
  return null
}
