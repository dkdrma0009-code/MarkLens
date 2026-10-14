import { cache } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadPublicBrandStates } from "@/lib/brand-watch/public/load"
import type { PublicQueryClient } from "@/lib/brand-watch/public/queries"
import { PUBLIC_BRAND_SLUGS, publicBrandIdentity } from "@/lib/brand-watch/public/view"
import { brandMetadata } from "@/lib/brand-watch/public/metadata"
import BrandDossier from "@/components/brand-watch/BrandDossier"

export const revalidate = 21600
// Only launch-registry brands have pages; any other slug is a 404 and never creates a cache entry.
export const dynamicParams = false
export function generateStaticParams() {
  return PUBLIC_BRAND_SLUGS.map(slug => ({ slug }))
}

interface Props { params: Promise<{ slug: string }> }

// Server-side read with the service-role client; only the sanitized public read model reaches rendering.
const loadState = cache(async (slug: string) => {
  if (!publicBrandIdentity(slug)) return null
  const [state] = await loadPublicBrandStates(() => createAdminClient() as unknown as PublicQueryClient, [slug], new Date().toISOString())
  return state ?? null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = await loadState((await params).slug)
  return state ? brandMetadata(state) : {}
}

export default async function BrandPage({ params }: Props) {
  const state = await loadState((await params).slug)
  if (!state) notFound()
  return <BrandDossier state={state} />
}
