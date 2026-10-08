"use client"

import { usePathname } from "next/navigation"
import Header from "./Header"
import Footer from "./Footer"
import PublicNotFound from "./PublicNotFound"
import "@/app/(public)/public.css"
import "@/app/(public)/remaining.css"

export default function NotFoundSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Keep the existing root fallback for admin/API/auth paths.
  if (/^\/(admin|api|auth)(\/|$)/.test(pathname)) return children
  return <div className="marklens-public"><Header /><main id="main-content"><PublicNotFound /></main><Footer /></div>
}
