"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const CATEGORIES = ["마케팅", "소비자 트렌드", "광고 전략", "디지털 마케팅", "FMCG", "브랜딩", "콘텐츠", "리테일"]

export default function ChallengeForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: "",
    summary: "",
    category: "마케팅",
    difficulty: "보통",
    source_name: "MarkLens",
    source_url: "",
    published_date: new Date().toISOString().slice(0, 10),
    active: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  function set(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.summary.trim()) return
    setSaving(true)
    setError("")

    const res = await fetch("/api/admin/insight-lab/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? "저장 실패")
    } else {
      setSuccess(true)
      setForm(f => ({ ...f, title: "", summary: "", source_url: "" }))
      router.refresh()
      setTimeout(() => setSuccess(false), 2000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">제목 *</label>
        <input
          value={form.title}
          onChange={e => set("title", e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">요약 (트렌드 내용) *</label>
        <textarea
          value={form.summary}
          onChange={e => set("summary", e.target.value)}
          rows={5}
          required
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">카테고리</label>
          <select
            value={form.category}
            onChange={e => set("category", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">난이도</label>
          <select
            value={form.difficulty}
            onChange={e => set("difficulty", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option>쉬움</option>
            <option>보통</option>
            <option>어려움</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">출처</label>
          <input
            value={form.source_name}
            onChange={e => set("source_name", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">발행일</label>
          <input
            type="date"
            value={form.published_date}
            onChange={e => set("published_date", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={form.active}
          onChange={e => set("active", e.target.checked)}
          className="rounded"
        />
        즉시 활성화
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-emerald-600">저장됐어요!</p>}
      <button
        type="submit"
        disabled={saving || !form.title.trim() || !form.summary.trim()}
        className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {saving ? "저장 중…" : "챌린지 등록"}
      </button>
    </form>
  )
}
