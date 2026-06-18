"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, Plus, Trash2, ChevronDown, ChevronUp, Loader2, Tag } from "lucide-react"
import type { InsightNote } from "@/types/insight-lab"

const FIELD_LABELS = [
  { key: "observation" as const, label: "현상 관찰", emoji: "👁" },
  { key: "cause" as const, label: "원인 분석", emoji: "🔍" },
  { key: "desire" as const, label: "숨은 욕구", emoji: "💡" },
  { key: "insight" as const, label: "인사이트", emoji: "✨" },
  { key: "opportunity" as const, label: "브랜드 기회", emoji: "🚀" },
]

function NoteCard({ note, onDelete }: { note: InsightNote; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/insight-lab/notes?id=${note.id}`, { method: "DELETE" })
    onDelete(note.id)
  }

  const date = new Date(note.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{note.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{date}</span>
            {note.source_label && (
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{note.source_label}</span>
            )}
            {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        }
      </button>
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="p-4 flex flex-col gap-4">
            {FIELD_LABELS.map(({ key, label, emoji }) => note[key] ? (
              <div key={key}>
                <p className="text-xs font-bold text-gray-400 mb-1">{emoji} {label}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{note[key]}</p>
              </div>
            ) : null)}
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateNoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (n: InsightNote) => void }) {
  const [form, setForm] = useState({ title: "", observation: "", cause: "", desire: "", insight: "", opportunity: "", tagInput: "", tags: [] as string[] })
  const [saving, setSaving] = useState(false)

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== ",") return
    e.preventDefault()
    const tag = form.tagInput.trim().replace(/^#/, "")
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag], tagInput: "" }))
    }
  }

  function removeTag(tag: string) {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await fetch("/api/insight-lab/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source_label: "직접 작성" }),
    })
    const data = await res.json()
    if (res.ok) {
      onCreated(data)
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">새 인사이트 노트</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">닫기</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <input
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="제목 *"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {FIELD_LABELS.map(({ key, label, emoji }) => (
            <div key={key}>
              <label className="text-xs font-bold text-gray-400 mb-1 block">{emoji} {label}</label>
              <textarea
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          {/* 태그 */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">태그 (Enter로 추가)</label>
            <input
              value={form.tagInput}
              onChange={e => set("tagInput", e.target.value)}
              onKeyDown={addTag}
              placeholder="#태그입력"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map(tag => (
                  <button key={tag} onClick={() => removeTag(tag)} className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">
                    #{tag} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={save}
            disabled={saving || !form.title.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotesTab() {
  const [notes, setNotes] = useState<InsightNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)

  const fetchNotes = useCallback(async (q?: string) => {
    setLoading(true)
    const url = `/api/insight-lab/notes${q ? `?q=${encodeURIComponent(q)}` : ""}`
    const res = await fetch(url)
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  useEffect(() => {
    const t = setTimeout(() => fetchNotes(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchNotes])

  function handleDelete(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="노트 검색…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          작성
        </button>
      </div>

      {/* 태그 필터 표시 (현재 노트의 모든 고유 태그) */}
      {!loading && notes.length > 0 && (() => {
        const allTags = [...new Set(notes.flatMap(n => n.tags))].slice(0, 8)
        if (!allTags.length) return null
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-gray-300" />
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSearch(`#${tag}`)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
        )
      })()}

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">📝</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search ? "검색 결과가 없어요" : "분석 후 노트에 저장하거나 직접 작성해보세요."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateNoteModal
          onClose={() => setShowModal(false)}
          onCreated={newNote => {
            setNotes(prev => [newNote, ...prev])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
