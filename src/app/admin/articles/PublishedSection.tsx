"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

export default function PublishedSection({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        발행됨
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{count}</span>
      </button>
      {open && children}
    </div>
  )
}
