"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"

export interface CardnewsRow {
  articleId: string
  hook: string | null
  title: string | null
  category: string | null
  createdAt: string
  cardAt: string | null
  postedAt: string | null
  usePhoto: boolean
}

type Filter = "all" | "todo" | "ready" | "posted"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "todo", label: "미생성" },
  { key: "ready", label: "업로드 대기" },
  { key: "posted", label: "업로드됨" },
]

function rowStatus(r: CardnewsRow): Filter {
  if (!r.cardAt) return "todo"
  return r.postedAt ? "posted" : "ready"
}

export default function CardnewsTable({ initialRows }: { initialRows: CardnewsRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("all")
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const bulkStop = useRef(false)

  const counts = useMemo(() => {
    const c = { all: rows.length, todo: 0, ready: 0, posted: 0 }
    for (const r of rows) c[rowStatus(r)]++
    return c
  }, [rows])

  // 전체 보기에서는 업로드 완료분을 맨 아래로 (작업 대상이 위로)
  const visible = useMemo(() => {
    const filtered = filter === "all" ? rows : rows.filter(r => rowStatus(r) === filter)
    if (filter !== "all") return filtered
    return [...filtered].sort((a, b) => {
      const ap = a.postedAt ? 1 : 0
      const bp = b.postedAt ? 1 : 0
      if (ap !== bp) return ap - bp
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [rows, filter])

  function patchRow(articleId: string, patch: Partial<CardnewsRow>) {
    setRows(prev => prev.map(r => (r.articleId === articleId ? { ...r, ...patch } : r)))
  }

  function setRowBusy(articleId: string, on: boolean) {
    setBusy(prev => {
      const next = new Set(prev)
      if (on) next.add(articleId)
      else next.delete(articleId)
      return next
    })
  }

  async function generateOne(articleId: string, silent = false): Promise<boolean> {
    setRowBusy(articleId, true)
    try {
      const res = await fetch("/api/admin/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "생성 실패")
      patchRow(articleId, {
        cardAt: new Date().toISOString(),
        usePhoto: data.slides?.[0]?.usePhoto === true,
      })
      if (!silent) toast.success("카드뉴스 생성 완료" + (data.warnings?.length ? ` (경고 ${data.warnings.length}건 — 편집에서 확인)` : ""))
      return true
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "생성 실패")
      return false
    } finally {
      setRowBusy(articleId, false)
    }
  }

  async function generateMissing() {
    const targets = rows.filter(r => !r.cardAt).map(r => r.articleId)
    if (!targets.length) return
    bulkStop.current = false
    let ok = 0
    for (let i = 0; i < targets.length; i++) {
      if (bulkStop.current) break
      setBulkProgress(`${i + 1}/${targets.length} 생성 중...`)
      if (await generateOne(targets[i], true)) ok++
    }
    setBulkProgress(null)
    toast[ok === targets.length ? "success" : "info"](`일괄 생성 완료: ${ok}/${targets.length}`)
  }

  async function togglePosted(r: CardnewsRow) {
    const next = !r.postedAt
    setRowBusy(r.articleId, true)
    try {
      const res = await fetch("/api/admin/cardnews/posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId, posted: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "처리 실패")
      patchRow(r.articleId, { postedAt: data.postedAt })
      toast.success(next ? "인스타 업로드 완료로 표시" : "업로드 표시 해제")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패")
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                filter === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {f.label} {counts[f.key]}
            </button>
          ))}
        </div>
        {counts.todo > 0 && (
          bulkProgress ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="animate-pulse">{bulkProgress}</span>
              <button onClick={() => { bulkStop.current = true }} className="px-2 py-1 rounded border border-border hover:bg-muted/50">중단</button>
            </div>
          ) : (
            <button
              onClick={generateMissing}
              className="text-xs px-3 py-1.5 rounded-md font-medium bg-foreground text-background hover:opacity-90"
            >
              미생성 {counts.todo}개 일괄 생성
            </button>
          )
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">표지</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">인사이트</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">카테고리</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">발행일</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map(r => {
              const status = rowStatus(r)
              const isBusy = busy.has(r.articleId)
              return (
                <tr key={r.articleId} className={`transition-colors ${status === "posted" ? "opacity-55 hover:opacity-100" : "hover:bg-muted/20"}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {/* 생성본은 실제 표지(updated_at 캐시버스트), 미생성은 인사이트 기반 프리뷰 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/cardnews/render?articleId=${r.articleId}&slide=1&v=${encodeURIComponent(r.cardAt ?? r.createdAt)}`}
                      alt="표지 미리보기"
                      loading="lazy"
                      className="w-20 h-[100px] object-cover rounded-md border border-border bg-black"
                    />
                    <p className="text-[10px] text-center mt-1 text-muted-foreground">
                      {!r.cardAt ? "프리뷰" : r.usePhoto ? "📷 기사 사진" : "Aa 타이포"}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-sm">
                    <p className="font-medium line-clamp-2 leading-snug">{r.hook ?? "—"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.title ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.category ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {status === "todo" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">미생성</span>
                    )}
                    {status === "ready" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                        생성됨 · {formatDate(r.cardAt!)}
                      </span>
                    )}
                    {status === "posted" && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">
                        업로드됨 · {formatDate(r.postedAt!)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    {status === "todo" ? (
                      <button
                        onClick={() => generateOne(r.articleId)}
                        disabled={isBusy}
                        className="text-xs px-3 py-1.5 rounded-md font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? "생성 중..." : "생성"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => togglePosted(r)}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                          title={r.postedAt ? "업로드 표시 해제" : "인스타 업로드 완료로 표시"}
                        >
                          {r.postedAt ? "↩ 해제" : "✓ 업로드 완료"}
                        </button>
                        <Link
                          href={`/admin/cardnews/${r.articleId}`}
                          className="text-xs px-3 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50"
                        >
                          편집
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
