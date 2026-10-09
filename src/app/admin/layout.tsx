import AdminShell from "@/components/admin-v2/AdminShell"
import "@/components/admin-v2/admin.css"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
