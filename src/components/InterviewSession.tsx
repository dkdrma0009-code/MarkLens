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
  star?: { s: boolean; t: boolean; a: boolean; r: boolean } | null
}

// 답변별 스피치 지표 (클라이언트 측정 — 서버 전송 없음)
interface AnswerMetrics {
  sec: number      // 답변 소요 시간
  chars: number    // 글자 수 (공백 제외)
  fillers: number  // 필러 단어 횟수
  voice: boolean   // 음성 답변 여부 (말속도 지표는 음성일 때만 의미)
}

const FILLER_WORDS = ["음", "어", "그", "이제", "막", "약간", "뭐", "어떤"]

function countFillers(text: string): number {
  const tokens = text.split(/\s+/)
  return tokens.filter(t => FILLER_WORDS.includes(t.replace(/[,.]/g, ""))).length
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
  const [metrics, setMetrics] = useState<(AnswerMetrics | null)[]>([])
  const qStartRef = useRef<number>(0)
  const voiceUsedRef = useRef(false)
  const stopRequestedRef = useRef(false) // 화상 모드 STT 자동 재시작 제어
  const videoModeRef = useRef(false)
  const answerRef = useRef("")

  // ── 음성 입력 (Web Speech API, 크롬 계열) ──
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false) // 면접관 TTS 발화 중
  const [speechSupported, setSpeechSupported] = useState(false)
  const recRef = useRef<{ stop: () => void } | null>(null)

  // ── 화상 모드 (v2.1) — 영상은 브라우저에만 저장, 서버 전송 없음 ──
  const [videoMode, setVideoMode] = useState(false)
  const [camStream, setCamStream] = useState<MediaStream | null>(null)
  const [camError, setCamError] = useState(false)
  const [clipRecording, setClipRecording] = useState(false)
  const [clips, setClips] = useState<(string | null)[]>([])
  const camVideoRef = useRef<HTMLVideoElement | null>(null)
  const clipRecRef = useRef<MediaRecorder | null>(null)
  const clipChunksRef = useRef<Blob[]>([])
  const camStreamRef = useRef<MediaStream | null>(null)

  function stopCamera() {
    try { clipRecRef.current?.state === "recording" && clipRecRef.current.stop() } catch {}
    try { speechSynthesis.cancel() } catch {}
    setSpeaking(false)
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current = null
    setCamStream(null)
    setClipRecording(false)
  }

  function startClip() {
    const stream = camStreamRef.current
    if (!stream || clipRecRef.current?.state === "recording") return
    try {
      clipChunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" })
      mr.ondataavailable = e => { if (e.data.size > 0) clipChunksRef.current.push(e.data) }
      clipRecRef.current = mr
      mr.start()
      setClipRecording(true)
    } catch { /* 미지원 — 화상 없이 진행 */ }
  }

  function stopClip(saveIndex: number) {
    const mr = clipRecRef.current
    if (!mr || mr.state !== "recording") return
    mr.onstop = () => {
      const blob = new Blob(clipChunksRef.current, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      setClips(prev => {
        const next = [...prev]
        next[saveIndex] = url
        return next
      })
    }
    try { mr.stop() } catch {}
    setClipRecording(false)
  }

  // 새 질문이 표시되면(화상 모드): 녹화 시작 → 면접관이 질문을 말함 → 발화가 끝나면 마이크 ON
  // (턴제로 실제 화상면접처럼. TTS가 끝난 뒤 받아적기를 시작해 면접관 음성이 마이크에 잡혀 오인식되는 것도 방지)
  useEffect(() => {
    if (stage === "interview" && videoMode && camStream && !feedback && !grading) {
      stopRequestedRef.current = false
      startClip()
      const text = questions[current]?.question
      const startListening = () => { if (speechSupported && !stopRequestedRef.current) startSpeech() }
      if (text) speak(text, startListening)
      else startListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, current, feedback, camStream])

  // 답변 타이머 시작 (질문 표시 시점)
  useEffect(() => {
    if (stage === "interview" && !feedback) {
      qStartRef.current = Date.now()
      voiceUsedRef.current = false
      answerRef.current = ""
    }
  }, [stage, current, feedback])

  useEffect(() => { videoModeRef.current = videoMode }, [videoMode])
  useEffect(() => { answerRef.current = answer }, [answer])

  // 미러 프리뷰 연결
  useEffect(() => {
    if (camVideoRef.current && camStream) {
      camVideoRef.current.srcObject = camStream
    }
  }, [camStream, stage, current, feedback])

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => {
      try { recRef.current?.stop() } catch {}
      try { speechSynthesis.cancel() } catch {}
      camStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function toggleMic() {
    if (recording) {
      try { recRef.current?.stop() } catch {}
      setRecording(false)
      return
    }
    startSpeech()
  }

  function startSpeech() {
    if (recording) return
    const w = window as unknown as Record<string, new () => unknown>
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as new () => {
      lang: string; continuous: boolean; interimResults: boolean
      onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
      onend: (() => void) | null; onerror: (() => void) | null
      start: () => void; stop: () => void
    }
    if (!SR) return
    const rec = new SR()
    rec.lang = "ko-KR"
    rec.continuous = true
    rec.interimResults = true
    voiceUsedRef.current = true
    let base = answerRef.current
    rec.onresult = (e) => {
      let interim = "", final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (final) base = (base + " " + final).trim()
      const text = (base + " " + interim).trim()
      answerRef.current = text
      setAnswer(text)
    }
    rec.onend = () => {
      setRecording(false)
      // 화상 모드: 침묵으로 STT가 끊겨도 답변 중이면 자동 재시작
      if (videoModeRef.current && !stopRequestedRef.current) {
        setTimeout(() => { if (!stopRequestedRef.current) startSpeech() }, 250)
      }
    }
    rec.onerror = () => setRecording(false)
    recRef.current = rec
    try { rec.start(); setRecording(true) } catch { /* 이미 실행 중 등 */ }
  }

  // 화상 모드: 받아적기 초기화 후 재시작
  function retrySpeak() {
    stopRequestedRef.current = true
    try { recRef.current?.stop() } catch {}
    setRecording(false)
    answerRef.current = ""
    setAnswer("")
    setTimeout(() => { stopRequestedRef.current = false; startSpeech() }, 300)
  }

  // 피드백 후 같은 질문 재도전 (짧은 답변 구제 — 질문 낭비 없음)
  function retryAnswer() {
    setQa(prev => prev.slice(0, current))
    setMetrics(prev => { const n = [...prev]; n[current] = null; return n })
    setClips(prev => { const u = prev[current]; if (u) URL.revokeObjectURL(u); const n = [...prev]; n[current] = null; return n })
    answerRef.current = ""
    setAnswer("")
    setFeedback(null)
  }

  // ── 면접관이 질문 읽어주기 (TTS) — 끝나면 onEnd 콜백 ──
  function speak(text: string, onEnd?: () => void) {
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "ko-KR"
      u.rate = 1.02
      const voices = speechSynthesis.getVoices()
      const ko = voices.find(v => v.lang === "ko-KR") || voices.find(v => v.lang?.startsWith("ko"))
      if (ko) u.voice = ko
      u.onstart = () => setSpeaking(true)
      u.onend = () => { setSpeaking(false); onEnd?.() }
      u.onerror = () => { setSpeaking(false); onEnd?.() }
      speechSynthesis.speak(u)
    } catch { setSpeaking(false); onEnd?.() }
  }

  // 질문 다시 듣기 — 듣는 동안 마이크를 멈췄다가 발화가 끝나면 재개(에코로 오인식 방지)
  function replayQuestion() {
    stopRequestedRef.current = true
    try { recRef.current?.stop() } catch {}
    setRecording(false)
    speak(questions[current]?.question ?? "", () => {
      if (speechSupported) { stopRequestedRef.current = false; startSpeech() }
    })
  }

  async function start() {
    setStage("loading")

    // 화상 모드: 카메라 권한 + 스트림 (실패해도 면접은 진행)
    clips.forEach(u => { if (u) URL.revokeObjectURL(u) })
    setClips([])
    setMetrics([])
    setCamError(false)
    if (videoMode && !camStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, facingMode: "user" },
          audio: true,
        })
        camStreamRef.current = stream
        setCamStream(stream)
      } catch {
        setCamError(true)
      }
    }

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
    stopRequestedRef.current = true // STT 자동 재시작 차단
    if (recording) { try { recRef.current?.stop() } catch {}; setRecording(false) }
    stopClip(current) // 화상 모드: 이 답변의 녹화 저장

    // 스피치 지표 측정
    const sec = Math.round((Date.now() - qStartRef.current) / 1000)
    const m: AnswerMetrics = {
      sec,
      chars: answer.replace(/\s/g, "").length,
      fillers: countFillers(answer),
      voice: voiceUsedRef.current,
    }
    setMetrics(prev => {
      const next = [...prev]
      next[current] = m
      return next
    })

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
    stopCamera() // 면접 종료 — 카메라 해제 (녹화 클립은 유지)
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

      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">면접 방식</p>
        <div className="flex gap-3">
          <button onClick={() => setVideoMode(false)}
            className={`flex-1 py-3 px-2 rounded-xl border-2 transition-all ${!videoMode ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
            <p className="text-sm font-bold">기본</p>
            <p className={`text-xs mt-0.5 ${!videoMode ? "text-white/70 dark:text-black/60" : "text-gray-400"}`}>타이핑 · 음성 답변</p>
          </button>
          <button onClick={() => setVideoMode(true)}
            className={`flex-1 py-3 px-2 rounded-xl border-2 transition-all ${videoMode ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
            <p className="text-sm font-bold">📹 화상 면접</p>
            <p className={`text-xs mt-0.5 ${videoMode ? "text-white/70 dark:text-black/60" : "text-gray-400"}`}>카메라 켜고 말로만 답변</p>
          </button>
        </div>
        {videoMode && (
          <p className="text-xs text-gray-400 mt-2">
            🔒 영상은 내 브라우저에만 저장돼요 — 서버로 전송되지 않고, 탭을 닫으면 사라집니다.
          </p>
        )}
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

      {/* 화상 모드 — 카메라 풀뷰 (질문은 면접관 음성으로만 전달) */}
      {videoMode && (
        <div className="relative w-full mb-5 rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          {camStream ? (
            <video ref={camVideoRef} autoPlay muted playsInline
              className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40 text-sm px-4 text-center">
              {camError ? "카메라를 사용할 수 없어요 (권한을 확인해주세요)" : "카메라 연결 중…"}
            </div>
          )}
          {/* 상태 (상단 중앙) — 면접관이 말하는 중 / 내가 답할 차례 */}
          <span className={`absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${
            speaking ? "bg-emerald-500/90 text-white" : recording ? "bg-black/65 text-white" : "bg-black/55 text-white/70"
          }`}>
            {speaking ? "🔊 면접관이 질문하고 있어요" : recording ? "🎙 말씀하세요" : "잠시만요…"}
          </span>
          {clipRecording && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/70 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
            </span>
          )}
        </div>
      )}

      {/* 면접관 질문 — 기본 모드만 텍스트로 표시 (화상 모드는 음성으로만) */}
      {!videoMode && (
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
      )}

      {/* 답변 — 화상 모드: 마이크 온리 (실시간 받아적기) */}
      {!feedback && videoMode && (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 min-h-[140px]">
            <p className="text-xs font-semibold text-gray-400 mb-2.5">
              {speaking ? "🔊 면접관이 질문하고 있어요 — 잠시 들어주세요" : recording ? "🎙 듣고 있어요 — 카메라를 보고 말씀하세요" : "🎙 마이크 연결 중..."}
            </p>
            {answer ? (
              <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">{answer}</p>
            ) : (
              <p className="text-base text-gray-300 dark:text-gray-600">말씀하시면 여기에 실시간으로 받아 적혀요</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={replayQuestion} disabled={grading || speaking} aria-label="질문 다시 듣기"
              className="px-3.5 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap disabled:opacity-40">
              🔊
            </button>
            <button onClick={retrySpeak} disabled={grading}
              className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">
              🔁 다시 말하기
            </button>
            <button onClick={submitAnswer} disabled={answer.trim().length < 10 || grading}
              className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {grading ? <><Loader2 className="w-4 h-4 animate-spin" /> 면접관이 평가 중...</> : "답변 완료"}
            </button>
          </div>
        </div>
      )}

      {/* 답변 — 기본 모드: 타이핑 + 선택적 마이크 */}
      {!feedback && !videoMode && (
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
          {/* 스피치 지표 + STAR 구조 */}
          <div className="flex flex-wrap items-center gap-2">
            {metrics[current] && (
              <>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  ⏱ {metrics[current].sec >= 60 ? `${Math.floor(metrics[current].sec / 60)}분 ${metrics[current].sec % 60}초` : `${metrics[current].sec}초`}
                </span>
                {metrics[current].voice && metrics[current].sec >= 5 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    🗣 분당 {Math.round(metrics[current].chars / (metrics[current].sec / 60))}자 {(() => { const v = Math.round(metrics[current].chars / (metrics[current].sec / 60)); return v > 400 ? "(빠른 편)" : v < 200 ? "(느린 편)" : "(적정)" })()}
                  </span>
                )}
                {metrics[current].voice && metrics[current].fillers > 0 && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${metrics[current].fillers >= 5 ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                    🤔 필러 {metrics[current].fillers}회
                  </span>
                )}
              </>
            )}
            {feedback.star && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                STAR
                {(["s", "t", "a", "r"] as const).map(k => (
                  <span key={k} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${feedback.star![k] ? "bg-indigo-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
                    {k.toUpperCase()}
                  </span>
                ))}
              </span>
            )}
          </div>

          {feedback.good?.trim() && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-5">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">👍 잘한 점</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.good}</p>
            </div>
          )}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-5">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1.5">🔧 아쉬운 점</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.improve}</p>
          </div>
          <div className="rounded-2xl border-2 border-gray-100 dark:border-gray-800 p-5">
            <p className="text-sm font-bold text-gray-500 mb-1.5">💬 이렇게 답하면 더 좋아요</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.model_answer}</p>
          </div>
          {(metrics[current]?.chars ?? 99) < 30 && (
            <button onClick={retryAnswer}
              className="w-full py-3.5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
              ✍️ 답변이 짧았어요 — 이 질문 다시 답변하기
            </button>
          )}
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

          {/* 스피치 요약 (음성/화상 답변이 있을 때) */}
          {metrics.some(Boolean) && (() => {
            const ms = metrics.filter((m): m is AnswerMetrics => !!m)
            const avgSec = Math.round(ms.reduce((a, m) => a + m.sec, 0) / ms.length)
            const voiced = ms.filter(m => m.voice && m.sec >= 5)
            const avgRate = voiced.length ? Math.round(voiced.reduce((a, m) => a + m.chars / (m.sec / 60), 0) / voiced.length) : null
            const totalFillers = ms.reduce((a, m) => a + m.fillers, 0)
            return (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">🎙 스피치 분석</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{avgSec >= 60 ? `${Math.floor(avgSec / 60)}분+` : `${avgSec}초`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">평균 답변 시간</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{avgRate ? `${avgRate}자` : "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">분당 말속도 {avgRate ? (avgRate > 400 ? "(빠름)" : avgRate < 200 ? "(느림)" : "(적정)") : "(음성 답변 없음)"}</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-black ${totalFillers >= 10 ? "text-red-500" : "text-gray-900 dark:text-gray-100"}`}>{totalFillers}회</p>
                    <p className="text-xs text-gray-400 mt-0.5">필러 단어 (음·어·그…)</p>
                  </div>
                </div>
              </div>
            )
          })()}

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

          {clips.some(Boolean) && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">📹 내 답변 다시보기</h2>
              <p className="text-xs text-gray-400 mb-4">영상은 이 브라우저에만 있어요 — 보관하려면 다운로드하세요. 탭을 닫으면 사라집니다.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {clips.map((url, i) => url && (
                  <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <video src={url} controls playsInline className="w-full aspect-video object-cover bg-black" />
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-xs font-semibold text-gray-500 line-clamp-1 flex-1 pr-2">Q{i + 1}. {qa[i]?.question ?? ""}</p>
                      <a href={url} download={`marklens-면접답변-${i + 1}.webm`}
                        className="text-xs font-semibold text-indigo-600 hover:underline whitespace-nowrap">저장</a>
                    </div>
                  </div>
                ))}
              </div>
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
        <button onClick={() => { stopCamera(); setStage("settings") }}
          className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity">
          직무 바꾸기
        </button>
      </div>
    </div>
  )

  return null
}
