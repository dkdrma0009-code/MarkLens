"use client"

import { useEffect, useState } from "react"

// 성장 플레이북 기반 데일리 루틴. MarkLens는 자동화가 많아 '리마인더' 성격.
const ITEMS = [
  { id: "drip", label: "오늘 드립 발행 확인 (사이트+인스타+스레드)" },
  { id: "diagnose", label: "어제 게시물 📉 진단 돌리기" },
  { id: "fix", label: "저성과 건 표지 교체 + 재렌더" },
  { id: "reply", label: "댓글·DM 30분 내 답장 (초반 체류시간)" },
  { id: "pin", label: "터진 콘텐츠 프로필 고정 + 스토리 유도" },
]

// KST 기준 날짜 키 — 매일 0시(KST)에 자연 리셋
function todayKey(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  return `marklens-checklist-${d.toISOString().slice(0, 10)}`
}

export default function DailyChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 1회 localStorage 로드(SSR 안전, hydration mismatch 방지)
      setChecked(JSON.parse(localStorage.getItem(todayKey()) || "{}"))
    } catch { /* 무시 */ }
  }, [])

  function toggle(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(todayKey(), JSON.stringify(next)) } catch { /* 무시 */ }
      return next
    })
  }

  const done = ITEMS.filter(i => checked[i.id]).length

  return (
    <div className="border border-border rounded-lg p-6 bg-background">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">데일리 체크리스트</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{done}/{ITEMS.length}</span>
      </div>
      <div className="space-y-2">
        {ITEMS.map(item => {
          const on = !!checked[item.id]
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-3 p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left"
            >
              <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${on ? "bg-foreground text-background border-foreground" : "border-border"}`}>
                {on ? "✓" : ""}
              </span>
              <span className={`flex-1 ${on ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">매일 0시(KST) 리셋 · 이 브라우저에만 저장</p>
    </div>
  )
}
