import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import "./public.css"
import "./remaining.css"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marklens-public">
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
