"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { measurePage } from "@/lib/analytics"

export default function AudienceAnalytics({ deployment }: { deployment?: string }) {
  const pathname = usePathname()
  useEffect(() => {
    const measure = () => measurePage(deployment)
    measure()
    window.addEventListener("popstate", measure)
    return () => window.removeEventListener("popstate", measure)
  }, [pathname, deployment])
  return null
}
