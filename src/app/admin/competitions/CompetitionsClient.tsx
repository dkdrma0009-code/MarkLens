"use client"

import { Fragment, useMemo, useState } from "react"
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <p className="text-sm text-foreground leading-relaxed">{value || "—"}</p>
    </div>
  )
}

export default function CompetitionsClient({ initialRows }: { initialRows: Competition[] }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("pending")
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [showText, setShowText] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        body: JSON.stringify({
          url,
          text: showText ? text : undefined,
          imageUrl: showText && imageUrl ? imageUrl : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "추가 실패")
      setRows(prev => [data.competition, ...prev])
      setUrl(""); setText(""); setImageUrl(""); setShowText(false)
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
          {showText ? "− 본문 직접 입력 닫기" : "+ 본문 직접 입력 (한국 사이트·차단 사이트용)"}
        </button>
        {showText && (
          <div className="mt-2 space-y-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="페이지 본문을 복사해 붙여넣으세요. (서버에서 직접 못 가져오는 한국 사이트·차단 사이트용)"
              rows={5}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
            />
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="(선택) 포스터 이미지 주소 — 우클릭 '이미지 주소 복사'. 없으면 텍스트 썸네일 자동 생성"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
            />
          </div>
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
                const expanded = expandedId === r.id
                return (
                  <Fragment key={r.id}>
                  <tr className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-4 py-3 max-w-md">
                      <button onClick={() => setExpandedId(expanded ? null : r.id)} className="font-medium text-left line-clamp-1 hover:underline">
                        {expanded ? "▾ " : "▸ "}{r.title}
                      </button>
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
                      <button onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50">미리보기</button>
                      {r.status !== "published" && (
                        <button onClick={() => setStatus(r, "published")} disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50">게시</button>
                      )}
                      {r.status !== "rejected" && (
                        <button onClick={() => setStatus(r, "rejected")} disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50">반려</button>
                      )}
                      <a
                        href={`/admin/cardnews?term=${encodeURIComponent(r.title)}`}
                        className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-blue-200 text-blue-600 hover:bg-blue-50"
                        title="이 공모전을 소재로 카드뉴스 생성"
                      >카드뉴스</a>
                      <button onClick={() => remove(r)} disabled={isBusy}
                        className="text-xs px-2.5 py-1.5 rounded-md font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">삭제</button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-4 py-5">
                        <div className="flex flex-col lg:flex-row gap-6">
                          {/* 게시될 텍스트 썸네일 (실제 렌더) */}
                          <div className="flex-shrink-0">
                            <p className="text-[11px] text-muted-foreground mb-1.5">게시 썸네일</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/admin/competitions/thumbnail?id=${r.id}&v=${encodeURIComponent(r.updated_at)}`}
                              alt="썸네일 미리보기"
                              loading="lazy"
                              className="w-72 max-h-80 rounded-lg border border-border bg-muted object-contain"
                            />
                          </div>
                          {/* 분석 전문 */}
                          <div className="flex-1 space-y-3 text-sm">
                            <Field label="요약" value={r.description} />
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="주최" value={r.organizer} />
                              <Field label="카테고리" value={r.category} />
                              <Field label="시작일" value={r.start_date ? formatDate(r.start_date) : null} />
                              <Field label="마감일" value={r.deadline ? formatDate(r.deadline) : "상시"} />
                              <Field label="시상" value={r.prize} />
                              <Field label="난이도" value={r.difficulty} />
                            </div>
                            <Field label="지원 자격" value={r.eligibility} />
                            <Field label="직무 적합" value={(r.job_fit ?? []).join(", ") || null} />
                            <p className="text-xs">
                              <span className="text-muted-foreground">원문: </span>
                              <a href={r.source_url} target="_blank" rel="noopener" className="text-sky-600 hover:underline break-all">{r.source_url}</a>
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
