import { revalidatePath } from "next/cache"

// Existing details refresh related recommendations through their safety TTL.
export function revalidatePublicContent(slugs: readonly string[]) {
  revalidatePath("/")
  revalidatePath("/insights")
  for (const slug of new Set(slugs)) {
    if (slug) revalidatePath(`/insights/${encodeURIComponent(slug)}`)
  }
}
