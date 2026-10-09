import { requireAdmin } from "@/lib/auth"
import { getOperationsOverview } from "@/components/admin-v2/overview-data"
import OperationsOverview from "@/components/admin-v2/OperationsOverview"

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()
  return <OperationsOverview data={await getOperationsOverview()} />
}
