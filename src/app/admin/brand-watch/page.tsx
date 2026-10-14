import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchBrandWatchAdminRows, type AdminQueryClient } from "@/lib/brand-watch/admin/queries"
import { buildAdminView } from "@/lib/brand-watch/admin/view"
import { parseConsoleParams } from "@/lib/brand-watch/admin/constants"
import BrandWatchConsole from "@/components/admin-v2/brand-watch/BrandWatchConsole"
import "@/components/admin-v2/brand-watch/brand-watch.css"

export const dynamic = "force-dynamic"

// Reads run here with the service-role client; only the derived read model reaches the browser.
export default async function BrandWatchAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const initial = parseConsoleParams(await searchParams)
  let view = null
  try {
    const { rows, truncated } = await fetchBrandWatchAdminRows(createAdminClient() as unknown as AdminQueryClient)
    view = buildAdminView(rows, new Date().toISOString(), { truncated })
  } catch { view = null }
  return <BrandWatchConsole view={view} initial={initial} />
}
