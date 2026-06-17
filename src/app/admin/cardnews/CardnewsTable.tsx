"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  reelsPostedAt: string | null
  scheduledAt: string | null
  usePhoto: boolean
  igPostId?: string | null
  igStats?: { likes: number; reach: number; saved: number } | null
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

export default function CardnewsTable({ initialRows, autoPublish, initialTerm }: { initialRows: CardnewsRow[]; autoPublish: boolean; initialTerm?: string }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("all")
  const [auto, setAuto] = useState(autoPublish)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const bulkStop = useRef(false)
  const [shortsModal, setShortsModal] = useState<{
    articleId: string; outputFile: string; slug: string; caption: string
  } | null>(null)
  const router = useRouter()
  const [term, setTerm] = useState(initialTerm ?? "")
  const [termBusy, setTermBusy] = useState(false)

  async function generateTerm() {
    if (term.trim().length < 2) { toast.error("용어를 2자 이상 입력하세요"); return }
    setTermBusy(true)
    try {
      const res = await fetch("/api/admin/cardnews/generate-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: term.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "생성 실패")
      toast.success("용어카드 생성 완료 — 편집 화면으로 이동합니다")
      router.push(`/admin/cardnews/${data.articleId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패")
    } finally {
      setTermBusy(false)
    }
  }

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

  async function schedulePost(r: CardnewsRow, date: string | null) {
    setRowBusy(r.articleId, true)
    try {
      const res = await fetch("/api/admin/cardnews/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId, scheduledAt: date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "예약 실패")
      patchRow(r.articleId, { scheduledAt: data.scheduledAt })
      toast.success(date ? `${date} 발행 예약됨 (KST 08:00)` : "예약 해제")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "예약 실패")
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  async function toggleAuto() {
    const next = !auto
    setAuto(next)
    try {
      const res = await fetch("/api/admin/cardnews/auto-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? "자동발행 ON — 매일 미발행 1건 자동 게시" : "자동발행 OFF")
    } catch {
      setAuto(!next)
      toast.error("설정 실패 (app_config 테이블 확인)")
    }
  }

  async function generateShorts(r: CardnewsRow) {
    setRowBusy(r.articleId, true)
    const toastId = toast.loading("숏츠 렌더 시작 중...")
    try {
      // 1) 렌더 트리거
      const triggerRes = await fetch("/api/admin/shorts/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId }),
      })
      if (!triggerRes.ok) {
        const data = await triggerRes.json().catch(() => ({}))
        throw new Error(data.error ?? "렌더 트리거 실패")
      }

      const ct = triggerRes.headers.get("content-type") ?? ""
      // 로컬 개발: 동기 렌더 — 바로 blob 반환
      if (ct.includes("video/mp4")) {
        const blob = await triggerRes.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `shorts-${r.articleId.slice(0, 6)}.mp4`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("숏츠 다운로드 완료! 🎬", { id: toastId })
        return
      }

      // 프로덕션: 비동기 — renderId 받아서 폴링
      const { renderId, bucketName, functionName, slug, caption } = await triggerRes.json()
      toast.loading("렌더 중... (Lambda)", { id: toastId })

      // 2) 상태 폴링 (최대 5분)
      const deadline = Date.now() + 5 * 60 * 1000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000))
        const params = new URLSearchParams({ renderId, bucketName, functionName })
        const statusRes = await fetch(`/api/admin/shorts/status?${params}`)
        const status = await statusRes.json()

        if (status.status === "error") throw new Error(status.error)
        if (status.status === "rendering") {
          toast.loading(`렌더 중... ${status.percent}%`, { id: toastId })
        }
        if (status.status === "done" && status.outputFile) {
          toast.success("렌더 완료! 다운로드 또는 릴스 발행을 선택하세요.", { id: toastId })
          // 릴스 캡션 = 카드뉴스 카루셀 풀 캡션(후킹+본문+CTA+해시태그) 재사용, 없으면 hook 폴백
          setShortsModal({ articleId: r.articleId, outputFile: status.outputFile, slug, caption: caption || r.hook || "" })
          return
        }
      }
      throw new Error("렌더 타임아웃 (5분 초과) — AWS Lambda 콘솔에서 확인")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "렌더 실패", { id: toastId })
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  async function downloadShorts() {
    if (!shortsModal) return
    const { outputFile, slug, articleId } = shortsModal
    setShortsModal(null)
    setRowBusy(articleId, true)
    const toastId = toast.loading("파일 다운로드 중...")
    try {
      const dlParams = new URLSearchParams({ outputFile, slug })
      const dlRes = await fetch(`/api/admin/shorts/download?${dlParams}`)
      if (!dlRes.ok) throw new Error("파일 다운로드 실패")
      const blob = await dlRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `shorts-${slug}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("숏츠 다운로드 완료! 🎬", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드 실패", { id: toastId })
    } finally {
      setRowBusy(articleId, false)
    }
  }

  async function publishReels() {
    if (!shortsModal) return
    const { outputFile, caption, articleId } = shortsModal
    setShortsModal(null)
    setRowBusy(articleId, true)
    const toastId = toast.loading("인스타 릴스 발행 중... (처리 최대 2분 소요)")
    try {
      const res = await fetch("/api/admin/shorts/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputFile, caption, articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "릴스 발행 실패")
      toast.success("인스타 릴스 발행 완료! 🎉", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "릴스 발행 실패", { id: toastId })
    } finally {
      setRowBusy(articleId, false)
    }
  }

  async function publishToInstagram(r: CardnewsRow) {
    if (!confirm(`"${r.hook ?? "카드뉴스"}"를 인스타그램에 지금 발행할까요?\n실제로 @marklens.site 피드에 게시됩니다.`)) return
    setRowBusy(r.articleId, true)
    try {
      const res = await fetch("/api/admin/cardnews/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "발행 실패")
      patchRow(r.articleId, { postedAt: new Date().toISOString() })
      toast.success("인스타그램 발행 완료! 🎉")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행 실패")
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  return (
    <>
      {/* 숏츠 렌더 완료 — 다운로드 / 릴스 발행 선택 모달 */}
      {shortsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-sm font-semibold mb-1">숏츠 렌더 완료</h3>
            <p className="text-xs text-muted-foreground mb-4">다운로드하거나 인스타 릴스로 바로 발행하세요.</p>
            <label className="block text-xs font-medium mb-1.5">릴스 캡션</label>
            <textarea
              value={shortsModal.caption}
              onChange={e => setShortsModal(m => m ? { ...m, caption: e.target.value } : m)}
              rows={4}
              placeholder="게시물 캡션을 입력하세요..."
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none mb-4"
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setShortsModal(null)}
                className="text-xs px-3 py-2 rounded-md border border-border text-muted-foreground hover:bg-muted/50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shortsModal?.caption ?? "")
                  toast.success("캡션 복사 완료")
                }}
                className="text-xs px-3 py-2 rounded-md border border-border font-medium hover:bg-muted/50"
              >
                캡션 복사
              </button>
              <button
                onClick={downloadShorts}
                className="text-xs px-3 py-2 rounded-md border border-border font-medium hover:bg-muted/50"
              >
                다운로드
              </button>
              <button
                onClick={publishReels}
                className="text-xs px-4 py-2 rounded-md font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
              >
                릴스 발행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 용어·꿀팁 카드 생성 (기사 없이 용어만으로) */}
      <div className="border border-border rounded-lg p-4 bg-background mb-6">
        <p className="text-sm font-medium mb-2">용어·꿀팁 카드 만들기</p>
        <div className="flex gap-2">
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") generateTerm() }}
            placeholder='예: "DR(도메인 레이팅)", "퍼포먼스 vs 브랜드 마케팅", "CTR이 뭐예요"'
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
          <button
            onClick={generateTerm}
            disabled={termBusy}
            className="px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {termBusy ? "생성 중..." : "용어카드 생성"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">취준생 기본기 콘텐츠. 생성 후 편집 화면에서 다듬어 다운로드하세요.</p>
      </div>

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
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAuto}
            title="매일 미발행 카드뉴스 1건을 자동으로 인스타 발행"
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              auto ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {auto ? "🟢 자동발행 ON" : "⚪ 자동발행 OFF"}
          </button>
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
                      {r.usePhoto ? "📷 기사 사진" : "Aa 타이포"}{!r.cardAt ? " · 프리뷰" : ""}
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
                    {r.reelsPostedAt && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 ml-1">
                        🎬 릴스 · {formatDate(r.reelsPostedAt)}
                      </span>
                    )}
                    {r.igStats && (
                      <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                        ♥{r.igStats.likes} · 도달{r.igStats.reach}
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
                        {!r.postedAt && (
                          <button
                            onClick={() => publishToInstagram(r)}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1.5 rounded-md font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50"
                          >
                            {isBusy ? "발행 중..." : "📤 인스타 발행"}
                          </button>
                        )}
                        <button
                          onClick={() => generateShorts(r)}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                          title="9:16 숏츠(mp4) 생성 — AWS Lambda 렌더"
                        >
                          🎬 숏츠
                        </button>
                        {!r.postedAt && (
                          <label
                            title={r.scheduledAt ? `예약됨: ${r.scheduledAt.slice(0, 10)} 해제하려면 클릭 후 날짜 지우기` : "발행 날짜 예약"}
                            className="relative"
                          >
                            <span className={`text-xs px-2.5 py-1.5 rounded-md font-medium border cursor-pointer hover:bg-muted/50 ${r.scheduledAt ? "border-blue-400 text-blue-600" : "border-border text-muted-foreground"}`}>
                              {r.scheduledAt ? `📅 ${r.scheduledAt.slice(0, 10)}` : "📅 예약"}
                            </span>
                            <input
                              type="date"
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                              value={r.scheduledAt ? r.scheduledAt.slice(0, 10) : ""}
                              min={new Date().toISOString().slice(0, 10)}
                              disabled={isBusy}
                              onChange={e => schedulePost(r, e.target.value || null)}
                            />
                          </label>
                        )}
                        <button
                          onClick={() => togglePosted(r)}
                          disabled={isBusy}
                          className="text-xs px-2.5 py-1.5 rounded-md font-medium border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                          title={r.postedAt ? "업로드 표시 해제" : "인스타 업로드 완료로 표시"}
                        >
                          {r.postedAt ? "↩ 해제" : "✓ 수동표시"}
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
