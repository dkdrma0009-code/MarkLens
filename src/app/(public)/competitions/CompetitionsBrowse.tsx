"use client"

import { useMemo, useState } from "react"
import { computePriority, ddayLabel } from "@/lib/competitions/priority"
import type { Competition } from "@/types"

const PRIORITY_RING: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-500", green: "bg-emerald-500",
}

const JOB_FILTERS = ["전체", "콘텐츠기획", "퍼포먼스", "브랜드", "데이터분석"]
const CAT_FILTERS = ["전체", "공모전", "대외활동", "서포터즈", "기타"]

// 외부 포스터 — weserv 프록시로 리사이즈·webp·CDN 캐시. 실패하면 Satori 텍스트 카드로 폴백.
function proxied(url: string): string {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=440&h=330&fit=cover&output=webp&q=72&maxage=7d`
}

function satoriThumb(id: string, updatedAt: string): string {
  return `/api/admin/competitions/thumbnail?id=${id}&v=${encodeURIComponent(updatedAt)}`
}

function Thumb({ c }: { c: Competition }) {
  const [src, setSrc] = useState<string>(
    c.thumbnail_url ? proxied(c.thumbnail_url) : satoriThumb(c.id, c.updated_at)
  )
  const [errored, setErrored] = useState(false)

  function handleError() {
    // weserv 실패 → Satori 텍스트 카드로 폴백
    const fallback = satoriThumb(c.id, c.updated_at)
    if (src !== fallback) { setSrc(fallback); return }
    setErrored(true) // Satori도 실패 시 최후 CSS 폴백
  }

  if (!errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={c.title}
        loading="lazy"
        onError={handleError}
        className="w-full aspect-[4/3] object-cover bg-gray-900"
      />
    )
  }
  // 최후 CSS 폴백 (Satori마저 실패한 극히 드문 경우)
  return (
    <div className="w-full aspect-[4/3] bg-gray-900 text-white flex flex-col justify-between p-4">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{c.category ?? "공모전"}</span>
        <span className={`px-2 py-0.5 rounded-full text-white bg-gray-600`}>{ddayLabel(c.deadline)}</span>
      </div>
      <div className="font-bold text-base leading-snug line-clamp-3">{c.title}</div>
      <div className="text-xs text-gray-400">{c.organizer ?? "MarkLens"}</div>
    </div>
  )
}

export default function CompetitionsBrowse({ items }: { items: Competition[] }) {
  const [job, setJob] = useState("전체")
  const [cat, setCat] = useState("전체")

  const filtered = useMemo(() => items.filter(c => {
    const jobOk = job === "전체" || (c.job_fit ?? []).includes(job)
    const catOk = cat === "전체" || c.category === cat
    return jobOk && catOk
  }), [items, job, cat])

  return (
    <>
      {/* 필터 */}
      <div className="space-y-2 mb-8">
        <div className="flex gap-1.5 flex-wrap">
          {CAT_FILTERS.map(f => (
            <button key={f} onClick={() => setCat(f)}
              className={`text-sm px-3.5 py-1.5 rounded-full border font-medium transition-colors ${cat === f ? "bg-black text-white border-black dark:bg-white dark:text-black" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {JOB_FILTERS.map(f => (
            <button key={f} onClick={() => setJob(f)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${job === f ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-black" : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">조건에 맞는 공모전이 없습니다.</p>
          <p className="text-sm">필터를 바꾸거나 곧 업데이트될 공모전을 기다려주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(c => {
            const priority = computePriority(c.deadline, c.difficulty)
            return (
              <a key={c.id} href={c.source_url} target="_blank" rel="noopener"
                className="group flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all">
                <div className="relative overflow-hidden">
                  <Thumb c={c} />
                  <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full text-white ${PRIORITY_RING[priority]}`}>
                    {ddayLabel(c.deadline)}
                  </span>
                </div>
                <div className="flex flex-col flex-1 p-4 gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{c.category ?? "공모전"}</span>
                    {c.difficulty && <span>· 난이도 {c.difficulty}</span>}
                  </div>
                  <p className="font-bold text-sm leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                    {c.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.description}</p>
                  <div className="flex flex-wrap gap-1 mt-auto pt-2">
                    {(c.job_fit ?? []).slice(0, 3).map((j, i) => (
                      <span key={i} className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-full px-2 py-0.5">{j}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="font-medium line-clamp-1">{c.organizer ?? "—"}</span>
                    <span className="flex-shrink-0">{c.prize ? c.prize.split(/[,(]/)[0].slice(0, 14) : ""}</span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}
