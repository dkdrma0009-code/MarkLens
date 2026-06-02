"use client"

import { useState } from "react"
import { Link2, Check } from "lucide-react"

interface Props {
  slug: string
  title: string
}

export default function ShareButtons({ slug, title }: Props) {
  const [copied, setCopied] = useState(false)
  const base = typeof window !== "undefined" ? window.location.origin : "https://marklens.site"
  const url = `${base}/insights/${slug}`

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareTwitter() {
    const text = encodeURIComponent(`${title}\n\n`)
    const link = encodeURIComponent(url)
    window.open(`https://x.com/intent/tweet?text=${text}&url=${link}`, "_blank", "noopener")
  }

  function shareLinkedIn() {
    const link = encodeURIComponent(url)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${link}`, "_blank", "noopener")
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">공유</span>

      <button
        onClick={shareTwitter}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all"
        title="X(트위터)에 공유"
      >
        <XIcon />
      </button>

      <button
        onClick={shareLinkedIn}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all"
        title="LinkedIn에 공유"
      >
        <LinkedInIcon />
      </button>

      <button
        onClick={copyLink}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all"
        title="링크 복사"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Link2 className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>
    </div>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-600">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.256 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-gray-600">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
