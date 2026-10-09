"use client"
import { useEffect, useState } from "react"

export default function NewsletterPreview({ issue }: { issue: { id: string; issue_number: number; title: string } }) {
  const [attempt, setAttempt] = useState(0)
  return <section className="newsletter-preview" aria-label="Email HTML Preview"><div className="ops-panel-heading"><div><p>EMAIL / PREVIEW</p><h3>#{issue.issue_number} · {issue.title}</h3></div><a className="admin-control" href={`/api/admin/newsletter-preview?id=${encodeURIComponent(issue.id)}`} target="_blank" rel="noopener noreferrer">새 탭 ↗</a></div><p className="admin-note">기존 발송 HTML renderer입니다. 개인별 구독 취소 링크와 실제 inbox 표시·전달 여부는 Preview로 검증되지 않습니다.</p><PreviewDocument key={`${issue.id}:${attempt}`} id={issue.id} retry={() => setAttempt(value => value + 1)} /></section>
}
function PreviewDocument({ id, retry }: { id: string; retry: () => void }) {
  const [state, setState] = useState<{ html?: string; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/newsletter-preview?id=${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(`Email Preview 조회 실패 (${response.status})`); const html = await response.text(); if (!controller.signal.aborted) setState({ html }) }).catch(error => { if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : "Preview 조회 실패" }) })
    return () => controller.abort()
  }, [id])
  return state.error ? <div className="admin-empty" role="alert"><p>{state.error}</p><button className="admin-control" onClick={retry}>Preview 다시 시도</button></div> : state.html ? <iframe title="기존 뉴스레터 Email HTML Preview" srcDoc={state.html} sandbox="allow-same-origin" /> : <p className="admin-empty" role="status">Email HTML을 불러오는 중…</p>
}
