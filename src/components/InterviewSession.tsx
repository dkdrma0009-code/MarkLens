"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Volume2, ChevronRight, RotateCcw, Share2, Copy, Check, Loader2 } from "lucide-react"

type Stage = "settings" | "loading" | "interview" | "grading" | "report"

interface Question {
  question: string
  kind: "trend" | "role" | "behavioral"
}

interface Feedback {
  good: string
  improve: string
  model_answer: string
}

interface Report {
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  soundbite: string
}

const ROLES = [
  { key: "퍼포먼스 마케팅", label: "퍼포먼스" },
  { key: "브랜드 마케팅", label: "브랜드" },
  { key: "콘텐츠 마케팅", label: "콘텐츠" },
  { key: "CRM 마케팅", label: "CRM" },
  { key: "마케팅 공통", label: "공통" },
]

const KIND_LABEL: Record<Question["kind"], string> = {
  trend: "🔥 트렌드 질문",
  role: "💼 직무 질문",
  behavioral: "🙋 인성·경험 질문",
}

export default function InterviewSession() {
  const [stage, setStage] = useState<Stage>("settings")
  const [role, setRole] = useState(ROLES[0].key)
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [grading, setGrading] = useState(false)
  const [qa, setQa] = useState<{ question: string; answer: string }[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [copied, setCopied] = useState(false)

  // ── 음성 입력 (Web Speech API, 크롬 계열) ──
  const [recording, setRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => { try { recRef.current?.stop() } catch {} }
  }, [])

  function toggleMic() {
    if (recording) {
      try { recRef.current?.stop() } catch {}
      setRecording(false)
      return
    }
    const w = window as unknown as Record<string, new () => unknown>
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as new () => {
      lang: string; continuous: boolean; interimResults: boolean
      onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
      onend: (() => void) | null; onerror: (() => void) | null
      start: () => void; stop: () => void
    }
    const rec = new SR()
    rec.lang = "ko-KR"
    rec.continuous = true
    rec.interimResults = true
    let base = answer
    rec.onresult = (e) => {
      let interim = "", final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (final) base = (base + " " + final).trim()
      setAnswer((base + " " + interim).trim())
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    recRef.current = rec
    rec.start()
    setRecording(true)
  }

  // ── 질문 읽어주기 (TTS) ──
  function speak(text: string) {
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "ko-KR"
      speechSynthesis.speak(u)
    } catch { /* 미지원 무시 */ }
  }

  async function start() {
    setStage("loading")
    try {
      const res = await fetch("/api/interview/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, count }),
      })
      const data = await res.json()
      if (!data.questions?.length) throw new Error()
      setQuestions(data.questions)
      setCurrent(0)
      setAnswer("")
      setFeedback(null)
      setQa([])
      setReport(null)
      setStage("interview")
    } catch {
      setStage("settings")
      alert("질문 생성에 실패했어요. 다시 시도해주세요.")
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || grading) return
    if (recording) { try { recRef.current?.stop() } catch {}; setRecording(false) }
    setGrading(true)
    const q = questions[current]
    try {
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, answer, role }),
      })
      const data = await res.json()
      if (!data.improve) throw new Error()
      setFeedback(data)
      setQa(prev => [...prev, { question: q.question, answer }])
    } catch {
      alert("피드백 생성에 실패했어요. 다시 제출해주세요.")
    } finally {
      setGrading(false)
    }
  }

  async function generateReport() {
    setStage("grading")
    try {
      const res = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, qa }),
      })
      const data = await res.json()
      if (!data.summary) throw new Error()
      setReport(data)
      setStage("report")
    } catch {
      // 실패 시 report 화면에서 재시도 UI 노출 (report=null)
      setReport(null)
      setStage("report")
    }
  }

  async function next() {
    if (current + 1 >= questions.length) {
      await generateReport()
    } else {
      setCurrent(current + 1)
      setAnswer("")
      setFeedback(null)
    }
  }

  async function copySoundbite() {
    if (!report?.soundbite) return
    try {
      await navigator.clipboard.writeText(report.soundbite)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  // 점수 카드 공유 (퀴즈와 동일 패턴)
  async function shareReport() {
    if (!report) return
    const S = 1080
    const c = document.createElement("canvas")
    c.width = S; c.height = S
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = "#10b981"; ctx.fillRect(0, 0, S, 12)
    ctx.textAlign = "center"
    ctx.fillStyle = "#888"; ctx.font = "600 34px sans-serif"
    ctx.fillText("MARKLENS · AI 모의면접", S / 2, 150)
    ctx.fillStyle = "#10b981"; ctx.font = "700 30px sans-serif"
    ctx.fillText(`${role}`, S / 2, 240)
    ctx.fillStyle = "#ffffff"; ctx.font = "900 300px sans-serif"
    ctx.fillText(`${report.score}`, S / 2 - 50, 590)
    ctx.fillStyle = "#555"; ctx.font = "900 110px sans-serif"
    ctx.fillText("점", S / 2 + 240, 590)
    ctx.fillStyle = "#f0f0f0"; ctx.font = "800 56px sans-serif"
    const msg = report.score >= 85 ? "면접 준비 완료 💪" : report.score >= 60 ? "조금만 더 다듬으면 합격각 ✨" : "오늘 연습한 만큼 늘었어요 📈"
    ctx.fillText(msg, S / 2, 760)
    ctx.fillStyle = "#777"; ctx.font = "500 38px sans-serif"
    ctx.fillText("AI 모의면접 무료로 해보기 · marklens.site/interview", S / 2, 960)

    const text = `AI 모의면접에서 ${report.score}점 받았어요! 너도 해봐 👉 marklens.site/interview`
    const blob: Blob | null = await new Promise(res => c.toBlob(res, "image/png"))
    if (blob) {
      const file = new File([blob], "marklens-interview.png", { type: "image/png" })
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], text, title: "MarkLens AI 모의면접" }); return } catch { return }
      }
    }
    if (navigator.share) {
      try { await navigator.share({ text, url: "https://marklens.site/interview", title: "MarkLens AI 모의면접" }); return } catch { return }
    }
    const a = document.createElement("a")
    a.href = c.toDataURL("image/png")
    a.download = "marklens-interview.png"
    a.click()
  }

  const q = questions[current]

  // ── 설정 ──
  if (stage === "settings") return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">지원 직무</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {ROLES.map(r => (
            <button key={r.key} onClick={() => setRole(r.key)}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${role === r.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">질문 수</p>
        <div className="flex gap-3">
          {[3, 5].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-all ${count === n ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {n}문항 (~{n * 3}분)
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        💡 최근 마케팅 트렌드를 인용한 질문이 섞여 나와요. 실제 면접처럼 소리 내어 답해보세요.
        {speechSupported ? " 마이크 버튼으로 음성 답변도 가능해요." : " (음성 답변은 크롬 브라우저에서 지원돼요)"}
      </div>

      <button onClick={start}
        className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold hover:opacity-90 transition-opacity">
        면접 시작하기
      </button>
    </div>
  )

  // ── 로딩 ──
  if (stage === "loading") return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p className="text-gray-500 text-base">면접관이 질문을 준비하고 있어요...</p>
    </div>
  )

  // ── 면접 진행 ──
  if (stage === "interview" && q) return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400 font-medium">{current + 1} / {questions.length}</span>
        <span className="text-sm text-gray-400">{KIND_LABEL[q.kind] ?? ""}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mb-8">
        <div className="h-full bg-black dark:bg-white rounded-full transition-all"
          style={{ width: `${((current + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {/* 면접관 질문 */}
      <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🧑‍💼</span>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-relaxed flex-1">{q.question}</p>
          <button onClick={() => speak(q.question)} aria-label="질문 읽어주기"
            className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 답변 입력 */}
      {!feedback && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={grading}
              rows={5}
              placeholder={recording ? "듣고 있어요... 말씀하세요 🎙" : "답변을 입력하거나 마이크로 말해보세요"}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base leading-relaxed focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-60 resize-none"
            />
            {speechSupported && (
              <button onClick={toggleMic} disabled={grading} aria-label={recording ? "녹음 중지" : "음성으로 답변"}
                className={`absolute bottom-4 right-3 p-3 rounded-full transition-all ${recording ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"}`}>
                {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
          <button onClick={submitAnswer} disabled={!answer.trim() || grading}
            className="w-full py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            {grading ? <><Loader2 className="w-4 h-4 animate-spin" /> 면접관이 평가 중...</> : "답변 제출"}
          </button>
        </div>
      )}

      {/* 질문별 피드백 */}
      {feedback && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-5">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">👍 잘한 점</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.good}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-5">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1.5">🔧 아쉬운 점</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.improve}</p>
          </div>
          <div className="rounded-2xl border-2 border-gray-100 dark:border-gray-800 p-5">
            <p className="text-sm font-bold text-gray-500 mb-1.5">💬 이렇게 답하면 더 좋아요</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.model_answer}</p>
          </div>
          <button onClick={next}
            className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            {current + 1 >= questions.length ? "종합 리포트 보기" : "다음 질문"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )

  // ── 리포트 생성 중 ──
  if (stage === "grading") return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p className="text-gray-500 text-base">면접 전체를 평가하고 있어요...</p>
    </div>
  )

  // ── 종합 리포트 ──
  if (stage === "report") return (
    <div>
      {!report && (
        <div className="text-center py-12 border border-gray-100 dark:border-gray-800 rounded-2xl mb-6">
          <p className="text-base font-bold text-gray-700 dark:text-gray-300 mb-2">리포트 생성에 실패했어요</p>
          <p className="text-sm text-gray-500 mb-5">잠시 후 다시 시도해주세요.</p>
          <button onClick={generateReport}
            className="px-6 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> 리포트 다시 생성
          </button>
        </div>
      )}
      {report && (
        <>
          <div className="text-center py-10 border border-gray-100 dark:border-gray-800 rounded-2xl mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{role} · 모의면접 결과</p>
            <p className="text-6xl font-black text-gray-900 dark:text-gray-100 mb-2">{report.score}<span className="text-3xl text-gray-400">점</span></p>
            <p className="text-gray-500 text-base px-8 leading-relaxed">{report.summary}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-5">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">💪 강점</p>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">· {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-5">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">🔧 보완점</p>
              <ul className="space-y-2">
                {report.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">· {s}</li>
                ))}
              </ul>
            </div>
          </div>

          {report.soundbite && (
            <div className="relative rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/50 p-6 pr-14 mb-6">
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2">🎁 다음 면접에서 쓸 한 마디</p>
              <p className="text-base text-gray-800 dark:text-gray-200 leading-[1.9]">{report.soundbite}</p>
              <button onClick={copySoundbite} aria-label="한 마디 복사"
                className="absolute top-5 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <button onClick={shareReport}
            className="w-full mb-3 py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" /> 결과 공유하기
          </button>
        </>
      )}

      <div className="flex gap-3">
        <button onClick={start}
          className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> 같은 직무로 다시
        </button>
        <button onClick={() => setStage("settings")}
          className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity">
          직무 바꾸기
        </button>
      </div>
    </div>
  )

  return null
}
