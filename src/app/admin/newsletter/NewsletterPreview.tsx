"use client"

import { useState } from "react"
import { X } from "lucide-react"

interface Issue {
  id: string
  issue_number: number
  title: string
  week_signals?: string
  case_of_week?: string
  ai_brief?: string
  portfolio_insight?: string
  career_lens?: string
}

const SECTIONS = [
  { key: "week_signals", label: "01 / This Week's Signals" },
  { key: "case_of_week", label: "02 / Case of the Week" },
  { key: "ai_brief", label: "03 / AI Marketing Brief" },
  { key: "portfolio_insight", label: "04 / Portfolio Insight ✦" },
  { key: "career_lens", label: "05 / Career Lens ✦" },
] as const

export default function NewsletterPreview({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        미리보기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-mono">#{issue.issue_number}</p>
                <h2 className="text-base font-semibold text-gray-900">{issue.title}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-8">
              {SECTIONS.map(({ key, label }) => {
                const content = issue[key]
                if (!content) return null
                return (
                  <div key={key}>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
