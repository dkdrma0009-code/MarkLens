import type { Metadata } from "next"
import AdminShell from "@/components/admin-v2/AdminShell"
import "@/components/admin-v2/admin.css"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
