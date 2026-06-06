"use client"

import { useState } from "react"
import { X, ExternalLink } from "lucide-react"

interface Issue {
  id: string
  issue_number: number
  title: string
}

export default function NewsletterPreview({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false)
  const previewUrl = `/api/admin/newsletter-preview?id=${issue.id}`

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
            style={{ height: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-gray-400 font-mono">#{issue.issue_number}</p>
                  <p className="text-sm font-semibold text-gray-900">{issue.title}</p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">실제 이메일 미리보기</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  새 탭
                </a>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors ml-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* iframe - 실제 이메일 HTML 렌더링 */}
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-b-2xl"
              title="뉴스레터 미리보기"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </>
  )
}
