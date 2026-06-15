"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import { computePriority, ddayLabel } from "@/lib/competitions/priority"
import type { Competition, CompetitionStatus } from "@/types"

type Filter = "all" | "pending" | "published" | "rejected" | "expired"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "검수 대기" },
  { key: "published", label: "게시됨" },
  { key: "rejected", label: "반려" },
  { key: "expired", label: "마감" },
]

const PRIORITY_STYLE: Record<string, string> = {
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  green: "bg-emerald-100 text-emerald-700",
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  published: "bg-sky-100 text-sky-700",
  rejected: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-400",
}

export default function CompetitionsClient({ initialRows }: { initialRows: Competition[] }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("pending")
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [showText, setShowText] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, published: 0, rejected: 0, expired: 0 }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter(r => r.status === filter)),
    [rows, filter]
  )

  function setRowBusy(id: string, on: boolean) {
    setBusy(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  }

  async function addCompetition() {
    if (!/^https?:\/\//.test(url)) { toast.error("유효한 URL을 입력하세요"); return }
    setAdding(true)
    try {
      const res = await fetch("/api/admin/competitions/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, text: showText ? text : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "추가 실패")
      setRows(prev => [data.competition, ...prev])
      setUrl(""); setText(""); setShowText(false)
      toast.success("공모전 분석·추가 완료")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가 실패")
    } finally {
      setAdding(false)
    }
  }

  async function setStatus(r: Competition, status: CompetitionStatus) {
    setRowBusy(r.id, true)
    try {
      const res = await fetch(`/api/admin/competitions/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "변경 실패")
      setRows(prev => prev.map(x => (x.id === r.id ? { ...x, status } : x)))
      toast.success(status === "published" ? "게시됨" : status === "rejected" ? "반려됨" : "변경됨")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "변경 실패")
    } finally {
      setRowBusy(r.id, false)
    }
  }

  async function remove(r: Competition) {
    if (!confirm(`"${r.title}" 삭제할까요?`)) return
    setRowBusy(r.id, true)
    try {
      const res = await fetch(`/api/admin/competitions/${r.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "삭제 실패")
      setRows(prev => prev.filter(x => x.id !== r.id))
      toast.success("삭제됨")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    } finally {
      setRowBusy(r.id, false)
    }
  }

  return (
    <>
      {/* 추가 폼 */}
      <div className="border border-border rounded-lg p-4 bg-background mb-6">
        <div className="flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="공모전·대외활동 URL (주최사 공식 페이지 권장)"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
          <button
            onClick={addCompetition}
            disabled={adding}
            className="px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {adding ? "분석 중..." : "분석·추가"}
          </button>
        </div>
        <button
          onClick={() => setShowText(v => !v)}
          className="text-xs text-muted-foreground mt-2 hover:text-foreground"
        >
          {showText ? "− 본문 직접 입력 닫기" : "+ 본문 직접 입력 (위비티 등 봇 차단 사이트용)"}
        </button>
        {showText && (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="페이지 본문을 복사해 붙여넣으세요. URL이 차단돼 자동 수집이 안 될 때 사용합니다."
            rows={5}
            className="w-full mt-2 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
          />
        )}
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              filter === f.key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {f.label} {counts[f.key]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          해당 상태의 공모전이 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">공모전</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">직무</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">마감</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(r => {
                const priority = computePriority(r.deadline, r.difficulty)
                const isBusy = busy.has(r.id)
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-4 py-3 max-w-md">
                      <div className="flex items-center gap-2">
                        <a href={r.source_url} target="_blank" rel="noopener" className="font-medium line-clamp-1 hover:underline">{r.title}</a>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {r.organizer ?? "—"}{r.prize ? ` · ${r.prize}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {(r.job_fit ?? []).slice(0, 2).join(", ") || "—"}
                      {r.difficulty ? <span className="block text-[11px] mt-0.5">난이도 {r.difficulty}</span> : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[priority]}`}>
                        {ddayLabel(r.deadline)}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1">{r.deadline ? formatDate(r.deadline) : "상시"}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                        {FILTERS.find(f => f.key === r.status)?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                      {r.status !== "published" && (
                        <button onClick={() => setStatus(r, "published")} disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50">게시</button>
                      )}
                      {r.status !== "rejected" && (
                        <button onClick={() => setStatus(r, "rejected")} disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">반려</button>
                      )}
                      <button onClick={() => remove(r)} disabled={isBusy}
                        className="text-xs px-2.5 py-1.5 rounded-md font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
