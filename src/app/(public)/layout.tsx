import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import PublicMotion from "@/components/layout/PublicMotion"
import "./public.css"
import "./remaining.css"
import "./motion.css"
import "./composition.css"
import "./continuous.css"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marklens-public">
      <PublicMotion />
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
