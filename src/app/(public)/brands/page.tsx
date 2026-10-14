import { cache } from "react"
import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadPublicBrandStates } from "@/lib/brand-watch/public/load"
import type { PublicQueryClient } from "@/lib/brand-watch/public/queries"
import { PUBLIC_BRAND_SLUGS, buildPublicBrandCard } from "@/lib/brand-watch/public/view"
import { brandsIndexMetadata } from "@/lib/brand-watch/public/metadata"
import BrandIndex from "@/components/brand-watch/BrandIndex"

// Same cadence as other ISR public pages; published Brand Watch data changes only through human review.
export const revalidate = 21600

// Server-side read with the service-role client; only the sanitized public read model reaches rendering.
const loadStates = cache(() => loadPublicBrandStates(() => createAdminClient() as unknown as PublicQueryClient, PUBLIC_BRAND_SLUGS, new Date().toISOString()))

export async function generateMetadata(): Promise<Metadata> {
  return brandsIndexMetadata(await loadStates())
}

export default async function BrandsPage() {
  return <BrandIndex cards={(await loadStates()).map(buildPublicBrandCard)} />
}
