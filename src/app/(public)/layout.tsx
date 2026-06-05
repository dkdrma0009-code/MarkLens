import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import MobileBottomNav from "@/components/layout/MobileBottomNav"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* 모바일에서 바텀 네비 높이(64px)만큼 여백 */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer className="hidden md:block" />
      <MobileBottomNav />
    </>
  )
}
