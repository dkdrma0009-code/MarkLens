"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DEFAULT_REEL_SETTINGS, type ReelSettings } from "@/remotion/ReelComposition"
import type { ReelPhotos } from "@/lib/shorts/reel-photos"
import type { Slide } from "@/lib/cardnews/types"
import { socialDate, type CardnewsRow } from "./types"

async function pollShortsStatus(params: URLSearchParams, onProgress: (percent: number) => void) {
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000))
    const statusRes = await fetch(`/api/admin/shorts/status?${params}`)
    const status = await statusRes.json()
    if (!statusRes.ok) throw new Error(status.error || "렌더 상태 조회 실패")
    if (status.status === "error") throw new Error(status.error)
    if (status.status === "rendering") onProgress(status.percent)
    if (status.status === "done" && status.outputFile) return status
  }
  throw new Error("렌더 타임아웃 (5분 초과) — AWS Lambda 콘솔에서 확인")
}

export default function useSocialOperations({ initialRows, autoPublish, initialTerm }: { initialRows: CardnewsRow[]; autoPublish: boolean | null; initialTerm?: string }) {
  const [rows, setRows] = useState(initialRows)
  const [auto, setAuto] = useState(autoPublish)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const bulkStop = useRef(false)
  function stopBulk() { bulkStop.current = true }
  const [shortsModal, setShortsModal] = useState<{
    articleId: string; outputFile: string; slug: string; caption: string
    kind: "숏츠" | "릴스컷" | "릴스"   // 모달 문구·다운로드 파일명이 렌더한 컷과 어긋나지 않도록
  } | null>(null)
  const [diagnoseModal, setDiagnoseModal] = useState<{
    articleId: string; loading: boolean; error?: string
    verdict?: string; causes?: string[]; fix?: string; newHeadlines?: string[]
    coverText?: string
    stats?: { reach: number; likes: number; saved: number; shares: number; comments: number }
  } | null>(null)
  // 릴스 미리보기 — 렌더 전에 연출을 조절해 보는 모달 (Remotion Player)
  const [reelPreview, setReelPreview] = useState<{
    row: CardnewsRow; slides: Slide[]; category: string; coverImage: string | null
    photos: ReelPhotos
    fromSaved: boolean   // 저장된 설정을 불러온 것인지 (비전 재판단 생략됨)
    settings: ReelSettings
  } | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  function rememberFocus(element: HTMLElement) { returnFocus.current = element }
  const router = useRouter()
  const [term, setTerm] = useState(initialTerm ?? "")
  const [termBusy, setTermBusy] = useState(false)

  const termLock = useRef(false)
  async function generateTerm() {
    if (termLock.current) return
    if (term.trim().length < 2) { toast.error("용어를 2자 이상 입력하세요"); return }
    termLock.current = true
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
      termLock.current = false
      setTermBusy(false)
    }
  }

  function patchRow(articleId: string, patch: Partial<CardnewsRow>) {
    setRows(prev => prev.map(r => (r.articleId === articleId ? { ...r, ...patch } : r)))
  }

  const locks = useRef(new Set<string>())
  function setRowBusy(articleId: string, on: boolean) {
    if (on && locks.current.has(articleId)) return false
    if (on) locks.current.add(articleId)
    else locks.current.delete(articleId)
    setBusy(prev => {
      const next = new Set(prev)
      if (on) next.add(articleId)
      else next.delete(articleId)
      return next
    })
    return true
  }

  async function generateOne(articleId: string, silent = false): Promise<boolean> {
    if (!setRowBusy(articleId, true)) return false
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
        slides: data.slides, caption: data.caption,
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

  const bulkLock = useRef(false)
  async function generateMissing() {
    if (bulkLock.current) return
    bulkLock.current = true
    const targets = rows.filter(r => !r.cardAt).map(r => r.articleId)
    if (!targets.length) { bulkLock.current = false; return }
    bulkStop.current = false
    let ok = 0
    for (let i = 0; i < targets.length; i++) {
      if (bulkStop.current) break
      setBulkProgress(`${i + 1}/${targets.length} 생성 중...`)
      if (await generateOne(targets[i], true)) ok++
    }
    setBulkProgress(null)
    bulkLock.current = false
    toast[ok === targets.length ? "success" : "info"](`일괄 생성 완료: ${ok}/${targets.length}`)
  }

  async function togglePosted(r: CardnewsRow) {
    const next = !r.postedAt
    if (!setRowBusy(r.articleId, true)) return
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
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패")
      return false
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  async function schedulePost(r: CardnewsRow, date: string | null) {
    if (!setRowBusy(r.articleId, true)) return
    try {
      const res = await fetch("/api/admin/cardnews/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId, scheduledAt: date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "예약 실패")
      patchRow(r.articleId, { scheduledAt: data.scheduledAt })
      toast.success(data.scheduledAt ? `저장된 예약: ${socialDate(data.scheduledAt)}` : "예약 해제")
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "예약 실패")
      return false
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  const autoLock = useRef(false)
  async function toggleAuto() {
    if (autoLock.current || auto === null) return
    autoLock.current = true
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
    } finally { autoLock.current = false }
  }

  // 릴스컷 미리보기 열기 — 슬라이드를 받아 Player로 재생하며 연출을 조절한다.
  async function openReelPreview(r: CardnewsRow) {
    if (!setRowBusy(r.articleId, true)) return
    const toastId = toast.loading("미리보기 불러오는 중...")
    try {
      const res = await fetch(`/api/admin/cardnews/slides?articleId=${r.articleId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패")
      // 저장된 설정이 있으면 그대로, 없으면 비전이 정한 자막 위치·줌을 초기값으로 채운다
      let settings: ReelSettings
      if (data.fromSaved && data.savedSettings) {
        settings = { ...DEFAULT_REEL_SETTINGS, ...data.savedSettings }
      } else {
        const hints = (data.hints ?? {}) as Record<string, { titlePos?: "top" | "center" | "bottom"; zoomFrom?: number; zoomTo?: number }>
        const shots: ReelSettings["shots"] = {}
        for (const [type, h] of Object.entries(hints)) {
          if (h) shots[type as keyof ReelSettings["shots"]] = { titlePos: h.titlePos, zoomFrom: h.zoomFrom, zoomTo: h.zoomTo }
        }
        settings = { ...DEFAULT_REEL_SETTINGS, layout: "cinematic", shots }
      }
      setReelPreview({
        row: r, slides: data.slides, category: data.category, coverImage: data.coverImage,
        photos: data.photos ?? {}, fromSaved: !!data.fromSaved, settings,
      })
      toast.dismiss(toastId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "불러오기 실패", { id: toastId })
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  // 사진과 연출을 이 기사에 고정한다. 사진을 같이 저장하는 게 핵심 — 설정만 저장하면
  // 다음에 열 때 사진이 바뀌어, 그 사진 구도를 전제로 정한 자막 위치·줌이 어긋난다.
  async function saveReelSettings() {
    if (!reelPreview || !setRowBusy(reelPreview.row.articleId, true)) return
    const toastId = toast.loading("설정 저장 중...")
    try {
      const res = await fetch("/api/admin/cardnews/reel-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: reelPreview.row.articleId,
          settings: reelPreview.settings,
          photos: reelPreview.photos,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "저장 실패")
      setReelPreview(p => (p ? { ...p, fromSaved: true } : p))
      toast.success("저장 완료 — 다음에 열면 이 설정 그대로 뜹니다", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패", { id: toastId })
    } finally { setRowBusy(reelPreview.row.articleId, false) }
  }

  // 저장을 지우고 AI가 다시 사진·연출을 정하게 한다
  async function resetReelSettings(articleId: string) {
    if (!setRowBusy(articleId, true)) return
    const toastId = toast.loading("초기화 중...")
    try {
      const res = await fetch(`/api/admin/cardnews/reel-settings?articleId=${articleId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "초기화 실패")
      setReelPreview(null)
      toast.success("초기화 완료 — 릴스컷을 다시 눌러주세요", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초기화 실패", { id: toastId })
    } finally { setRowBusy(articleId, false) }
  }

  // composition="Reel"은 릴스컷 — 정보 나열 장면을 빼고 켄번즈 모션을 넣은 짧은 버전.
  // settings는 미리보기에서 조절한 값. 미지정이면 컴포지션 기본값이 쓰인다.
  async function generateShorts(r: CardnewsRow, composition: "Shorts" | "Reel" | "ReelKineticVideo" = "Shorts", settings?: ReelSettings, photos?: ReelPhotos) {
    const kind = composition === "Reel" ? "릴스컷" : composition === "ReelKineticVideo" ? "릴스" : "숏츠"
    const prefix = composition === "Shorts" ? "shorts" : "reel"
    if (!setRowBusy(r.articleId, true)) return
    const toastId = toast.loading(`${kind} 렌더 시작 중...`)
    try {
      // 1) 렌더 트리거
      const triggerRes = await fetch("/api/admin/shorts/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId, composition, settings, photos }),
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
        a.download = `${prefix}-${r.articleId.slice(0, 6)}.mp4`
        a.click()
        URL.revokeObjectURL(url)
        setShortsModal(null)
      toast.success(`${kind} 다운로드 완료! 🎬`, { id: toastId })
        return
      }

      // 프로덕션: 비동기 — renderId 받아서 폴링
      const { renderId, bucketName, functionName, slug, caption } = await triggerRes.json()
      toast.loading("렌더 중... (Lambda)", { id: toastId })

      // 2) 상태 폴링 (최대 5분)
      const params = new URLSearchParams({ renderId, bucketName, functionName })
      const status = await pollShortsStatus(params, percent => {
        toast.loading(`렌더 중... ${percent}%`, { id: toastId })
      })
      toast.success("렌더 완료! 다운로드 또는 릴스 발행을 선택하세요.", { id: toastId })
      // 릴스 캡션 = 카드뉴스 카루셀 풀 캡션(후킹+본문+CTA+해시태그) 재사용, 없으면 hook 폴백
      setShortsModal({ articleId: r.articleId, outputFile: status.outputFile, slug, caption: caption || r.hook || "", kind })
      return
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "렌더 실패", { id: toastId })
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  async function downloadShorts() {
    if (!shortsModal) return
    const { outputFile, slug, articleId, kind } = shortsModal
    if (!setRowBusy(articleId, true)) return
    const toastId = toast.loading("파일 다운로드 중...")
    try {
      const dlParams = new URLSearchParams({ outputFile, slug })
      const dlRes = await fetch(`/api/admin/shorts/download?${dlParams}`)
      if (!dlRes.ok) throw new Error("파일 다운로드 실패")
      const blob = await dlRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${kind === "숏츠" ? "shorts" : "reel"}-${slug}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      setShortsModal(null)
      toast.success(`${kind} 다운로드 완료! 🎬`, { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드 실패", { id: toastId })
    } finally {
      setRowBusy(articleId, false)
    }
  }

  async function publishReels() {
    if (!shortsModal) return
    const { outputFile, caption, articleId } = shortsModal
    if (!setRowBusy(articleId, true)) return
    const toastId = toast.loading("인스타 릴스 발행 중... (처리 최대 2분 소요)")
    try {
      const res = await fetch("/api/admin/shorts/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputFile, caption, articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "릴스 발행 실패")
      setShortsModal(null)
      patchRow(articleId, { reelsPostedAt: new Date().toISOString(), igPostId: data.postId })
      toast.success("Instagram Reel 발행 응답 수신", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "릴스 발행 실패", { id: toastId })
    } finally {
      setRowBusy(articleId, false)
    }
  }

  // 성과 부진 진단 — 발행된 게시물의 IG 지표 + 표지 문구를 AI가 분석해 "왜 안 터졌나 + 새 표지 훅" 제시
  async function diagnose(r: CardnewsRow) {
    if (!setRowBusy(r.articleId, true)) return
    setDiagnoseModal({ articleId: r.articleId, loading: true })
    try {
      const res = await fetch("/api/admin/shorts/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId }),
      })
      const data = await res.json()
      if (!res.ok) { setDiagnoseModal({ articleId: r.articleId, loading: false, error: data.error ?? "진단 실패" }); return }
      setDiagnoseModal({ articleId: r.articleId, loading: false, ...data })
    } catch {
      setDiagnoseModal({ articleId: r.articleId, loading: false, error: "진단 요청 실패" })
    } finally { setRowBusy(r.articleId, false) }
  }

  // 진단이 제안한 새 훅으로 표지 교체 → 자동으로 릴스 재렌더 (도달의 핵심이라 릴스로)
  async function applyHook(articleId: string, headline: string) {
    if (!setRowBusy(articleId, true)) return
    const toastId = toast.loading("표지 교체 중...")
    try {
      const res = await fetch("/api/admin/cardnews/set-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, headline }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "표지 교체 실패")
      patchRow(articleId, { cardAt: new Date().toISOString() }) // 표지 미리보기 캐시버스트
      toast.success("표지 교체 완료 — 릴스 재렌더 시작" + (data.warnings?.length ? ` (글자수 경고 ${data.warnings.length})` : ""), { id: toastId })
      setDiagnoseModal(null)
      const row = rows.find(r => r.articleId === articleId)
      setRowBusy(articleId, false)
      if (row) await generateShorts(row, "Reel")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "표지 교체 실패", { id: toastId })
    } finally { setRowBusy(articleId, false) }
  }

  async function publishToInstagram(r: CardnewsRow) {
    if (!setRowBusy(r.articleId, true)) return
    try {
      const res = await fetch("/api/admin/cardnews/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: r.articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "발행 실패")
      patchRow(r.articleId, { postedAt: new Date().toISOString(), igPostId: data.postId })
      toast.success("인스타그램 발행 완료! 🎉")
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행 실패")
      return false
    } finally {
      setRowBusy(r.articleId, false)
    }
  }

  return { rememberFocus, returnFocus, rows, auto, busy, bulkProgress, stopBulk, term, setTerm, termBusy, generateTerm,
    generateOne, generateMissing, togglePosted, schedulePost, toggleAuto, openReelPreview,
    reelPreview, setReelPreview, saveReelSettings, resetReelSettings, generateShorts,
    shortsModal, setShortsModal, downloadShorts, publishReels,
    diagnoseModal, setDiagnoseModal, diagnose, applyHook, publishToInstagram, patchRow }
}
export type SocialOperations = ReturnType<typeof useSocialOperations>
