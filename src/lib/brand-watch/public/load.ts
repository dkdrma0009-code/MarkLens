import { fetchPublicBrandRows, type PublicQueryClient } from "./queries"
import { buildPublicBrandState, errorStates } from "./view"
import type { PublicBrandState } from "./types"

// Server-only entry used by the public pages. A failed load yields explicit error states; no partial or
// fallback data is ever substituted. Database messages never leave this function.
export async function loadPublicBrandStates(client: () => PublicQueryClient, slugs: readonly string[], now: string): Promise<PublicBrandState[]> {
  try {
    const rows = await fetchPublicBrandRows(client(), slugs)
    return slugs.map(slug => buildPublicBrandState(slug, rows, now)).filter((state): state is PublicBrandState => state !== null)
  } catch {
    return errorStates(slugs)
  }
}
