import AdKitStudio from "./AdKitStudio"
import { requireAdmin } from "@/lib/auth"
export const dynamic = "force-dynamic"
export default async function AdKitPage() {
  await requireAdmin()
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>ADKIT ASSETS</p><h2>Reusable branded video assets</h2><span>기존 Overlay / Endcard PNG · 1080 × 1920</span></div></div><AdKitStudio /></div>
}
