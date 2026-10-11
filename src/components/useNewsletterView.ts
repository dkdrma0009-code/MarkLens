"use client"

import { useEffect, useRef } from "react"
import { trackEvent } from "@/lib/analytics"

export function useNewsletterView(location: string, position?: string) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewed = useRef(false)
  useEffect(() => {
    if (!rootRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !viewed.current) {
        viewed.current = true
        trackEvent("newsletter_view", { location, position })
        observer.disconnect()
      }
    }, { threshold: 0.5 })
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [location, position])
  return rootRef
}
