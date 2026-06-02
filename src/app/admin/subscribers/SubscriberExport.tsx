"use client"

interface Subscriber {
  email: string
  status: string
  subscribed_at: string
}

export default function SubscriberExport({ subscribers }: { subscribers: Subscriber[] }) {
  function downloadCsv() {
    const header = "이메일,상태,구독일"
    const rows = subscribers.map(s =>
      `${s.email},${s.status},${new Date(s.subscribed_at).toLocaleDateString("ko-KR")}`
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `marklens-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={downloadCsv}
      className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors"
    >
      CSV 내보내기
    </button>
  )
}
