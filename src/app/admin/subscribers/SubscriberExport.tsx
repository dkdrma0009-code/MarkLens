"use client"

interface Subscriber {
  email: string
  status: string
  subscribed_at: string
}

export default function SubscriberExport({ subscribers }: { subscribers: Subscriber[] }) {
  function downloadCsv() {
    const header = "이메일,상태,구독일"
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`
    const rows = subscribers.map(s =>
      [s.email, s.status, new Date(s.subscribed_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })].map(cell).join(",")
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
      disabled={!subscribers.length}
      className="admin-control"
    >
      표시된 결과 CSV
    </button>
  )
}
