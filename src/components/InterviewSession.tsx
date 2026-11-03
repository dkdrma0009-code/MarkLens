"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Volume2, VolumeX, ChevronRight, RotateCcw, Share2, Copy, Check, Loader2 } from "lucide-react"
import { AI_DATA_NOTICE, aiFailureKind, aiOffForSession, apiFailureMessage, classifyMediaError, classifySpeechError, isInSiteLeave, leaveWarning, MEDIA_MESSAGES, mediaSupportIssue, pickRecorderMime, READING_TIMEOUT_MESSAGE, RECORDING_UNSUPPORTED_MESSAGE, recordingExtension, type MediaIssue } from "@/lib/interview/support"
import { createQuestionReader, createSpeechInput, type QuestionReader, type RecognitionLike, type SpeechInput, type UtteranceLike } from "@/lib/interview/voice"

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

// One answered question. The result screen is built from these, so it works without any AI response.
interface QaEntry {
  question: string
  answer: string
  feedback: Feedback | null // null: skipped, failed or AI stopped
}

// 답변별 스피치 지표 (클라이언트 측정 — 서버 전송 없음)
interface AnswerMetrics {
  sec: number      // 답변 소요 시간
  chars: number    // 글자 수 (공백 제외)
  fillers: number  // 필러 단어 횟수
  // How the answer was written. Speaking rate and fillers are measured only on "voice": a typed or edited text is not
  // what was said, so it is never reported as speech.
  input: "voice" | "text" | "mixed"
}

const FILLER_WORDS = ["음", "어", "그", "이제", "막", "약간", "뭐", "어떤"]

function countFillers(text: string): number {
  const tokens = text.split(/\s+/)
  return tokens.filter(t => FILLER_WORDS.includes(t.replace(/[,.]/g, ""))).length
}

const formatDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`)

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

const STAR_LABEL = { s: "상황", t: "과제", a: "행동", r: "결과" } as const

const KIND_LABEL: Record<Question["kind"], string> = {
  trend: "🔥 트렌드 질문",
  role: "💼 직무 질문",
  behavioral: "🙋 인성·경험 질문",
}

interface InterviewSessionProps {
  externalQuestions?: Question[]
  externalRole?: string
  externalCompanyName?: string  // 리포트 API에 전달
  feedbackContext?: string  // 자소서/JD 요약 — 피드백 API에 전달해 모범답안 맥락화
  onGoBack?: () => void     // "직무 바꾸기" 오버라이드 — prep 모드에서 폼으로 돌아가기
  onRetry?: () => Promise<Question[]>  // "같은 설정으로 다시" 오버라이드 — prep 모드 재생성
  onLeaveWarningChange?: (message: string) => void // prep 모드: "정보 수정"이 이 기록을 지우기 전에 물어볼 문구("" = 지울 것 없음)
}

// Browser capabilities are read after hydration; SSR uses a stable snapshot.
function subscribeSpeechSupport() { return () => {} }
function getSpeechSupport() {
  const w = window as unknown as Record<string, unknown>
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}
function getReadingSupport() {
  return typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined"
}

export default function InterviewSession({ externalQuestions, externalRole, externalCompanyName, feedbackContext, onGoBack, onRetry, onLeaveWarningChange }: InterviewSessionProps = {}) {
  const isPrepMode = !!externalQuestions?.length
  const [error, setError] = useState("")
  const [stage, setStage] = useState<Stage>(isPrepMode ? "interview" : "settings")
  const [role, setRole] = useState(externalRole ?? ROLES[0].key)
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState<Question[]>(externalQuestions ?? [])
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [grading, setGrading] = useState(false)
  const [qa, setQa] = useState<QaEntry[]>([])
  const [report, setReport] = useState<Report | null>(null)
  // Why the AI summary is missing, and whether asking again can help (not after an operator stop or a spent quota).
  const [reportFailure, setReportFailure] = useState<{ message: string; retry: boolean } | null>(null)
  const reportBusyRef = useRef(false)
  // Set once the AI is known to be stopped or out of quota: the rest of the session skips AI requests.
  const [aiOff, setAiOff] = useState<"paused" | "quota" | null>(null)
  const aiOffRef = useRef<"paused" | "quota" | null>(null)
  const [copied, setCopied] = useState(false)
  const [metrics, setMetrics] = useState<(AnswerMetrics | null)[]>([])
  const qStartRef = useRef<number>(0)
  const answerEndRef = useRef<number | null>(null) // first submission of this answer: a retried request is not answer time
  const spokenRef = useRef(false) // this answer got recognized speech
  const typedRef = useRef(false)  // this answer was typed or edited by hand
  const answerRef = useRef("")

  // ── 장치 선택 — 모두 기본 꺼짐. 답변은 언제나 입력창으로 할 수 있고, 카메라·마이크·질문 읽기는 켤 때만 쓴다 ──
  // Preferences, kept for the whole session (restart, change role). The refs serve callbacks of the voice controllers.
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [autoRead, setAutoRead] = useState(false)
  const micOnRef = useRef(false)
  const autoReadRef = useRef(false)
  const setMic = (on: boolean) => { micOnRef.current = on; setMicOn(on) }
  const setRead = (on: boolean) => { autoReadRef.current = on; setAutoRead(on) }
  // Sound in the recording: a sub-option of the camera, off by default and separate from "음성 답변" (speech-to-text).
  // Only when it is on does the camera request use the microphone.
  const [recordAudio, setRecordAudio] = useState(false)
  const recordAudioRef = useRef(false)
  const setSound = (on: boolean) => { recordAudioRef.current = on; setRecordAudio(on) }
  // Changed while an answer was being recorded: that recording keeps its setting (no track swap during a recording) and
  // the camera reopens with the new one once it has ended, for the next answer.
  const [soundChangePending, setSoundChangePending] = useState(false)
  const [soundNotice, setSoundNotice] = useState("")

  // ── 음성 입력 (Web Speech API, 크롬 계열) ──
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false) // 면접관이 질문을 읽는 중
  const [readingNotice, setReadingNotice] = useState("") // 질문 읽기가 끝나지 않아 멈췄을 때
  const speechSupported = useSyncExternalStore(subscribeSpeechSupport, getSpeechSupport, () => false)
  const readingSupported = useSyncExternalStore(subscribeSpeechSupport, getReadingSupport, () => false)
  // Speech input and question reading (src/lib/interview/voice.ts), created on first use in the browser. Their callbacks
  // use only state setters and refs, so an event from an earlier render or question never acts on stale state.
  const speechRef = useRef<SpeechInput | null>(null)
  const readerRef = useRef<QuestionReader | null>(null)

  // ── 카메라 녹화 (v2.1) — 영상은 브라우저에만 저장, 서버 전송 없음 ──
  const [camStream, setCamStream] = useState<MediaStream | null>(null)
  const [camIssue, setCamIssue] = useState<MediaIssue | null>(null)
  const camRequestRef = useRef(0) // bumped by every camera request and by stopCamera: a late answer is dropped
  // A fatal speech-recognition error (mic refused, no mic, no service) stops the automatic restart and opens typing.
  const [speechIssue, setSpeechIssue] = useState("")
  const [notice, setNotice] = useState("") // e.g. questions came from the no-AI fallback bank
  const [feedbackFailed, setFeedbackFailed] = useState(false)
  const [clipRecording, setClipRecording] = useState(false)
  // type = what the browser recorded (webm, mp4, …); the download name follows it, nothing is converted.
  // audio = the recording has a sound track (the result screen says so).
  const [clips, setClips] = useState<({ url: string; type: string; audio: boolean } | null)[]>([])
  const [recordIssue, setRecordIssue] = useState("") // this browser cannot record (the preview still works)
  const camVideoRef = useRef<HTMLVideoElement | null>(null)
  const clipRecRef = useRef<MediaRecorder | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  // Cameras and microphones this device has, read without a permission prompt (enumerateDevices). null = unknown.
  const [devices, setDevices] = useState<{ camera: boolean; mic: boolean } | null>(null)

  const clipsRef = useRef(clips) // for the unmount cleanup
  // Where focus goes when the screen changes (the button pressed is gone, focus would fall to <body>).
  const questionRef = useRef<HTMLParagraphElement | null>(null)
  const feedbackHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null)

  function speech() {
    return speechRef.current ??= createSpeechInput({
      create: () => {
        const w = window as unknown as Record<string, (new () => RecognitionLike) | undefined>
        const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
        return SR ? new SR() : null
      },
      baseText: () => answerRef.current,
      onText: text => { spokenRef.current = true; answerRef.current = text; setAnswer(text) },
      onListening: setRecording,
      // Refused microphone, no microphone, no service: the microphone setting turns off and typing carries on.
      onFatal: message => { setSpeechIssue(message); setMic(false) },
      // 마이크를 켜 둔 동안: 침묵으로 인식이 끊겨도 다시 듣는다(치명적 오류 뒤에는 다시 시작하지 않는다)
      autoRestart: () => micOnRef.current,
      classifyError: classifySpeechError,
    })
  }

  function reader() {
    return readerRef.current ??= createQuestionReader({
      synth: () => (typeof speechSynthesis === "undefined" ? null : speechSynthesis as unknown as { speak: (u: UtteranceLike) => void; cancel: () => void }),
      utterance: text => {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = "ko-KR"
        u.rate = 1.02
        const voices = speechSynthesis.getVoices()
        const ko = voices.find(v => v.lang === "ko-KR") || voices.find(v => v.lang?.startsWith("ko"))
        if (ko) u.voice = ko
        return u as unknown as UtteranceLike
      },
      onReading: on => { setSpeaking(on); if (on) setReadingNotice("") },
      onTimeout: () => setReadingNotice(READING_TIMEOUT_MESSAGE),
    })
  }

  function stopCamera() {
    camRequestRef.current++ // a camera request still waiting for permission is dropped when it answers
    // Still recording here = an answer that was not given (stopClip saves the given ones first): drop that recording.
    const mr = clipRecRef.current
    if (mr?.state === "recording") { mr.onstop = null; try { mr.stop() } catch {} }
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current = null
    setCamStream(null)
    setClipRecording(false)
    // a sound change waiting for this camera is moot: the next openCamera reads the setting itself
    setSoundChangePending(false)
    setSoundNotice("")
  }

  // One recording per answer, saved however it ends: submitted, camera turned off, or the device went away — Chrome
  // stops a recorder by itself when its last track ends (2026-11 QA), so the save cannot wait for stopClip.
  function startClip() {
    const stream = camStreamRef.current
    if (!stream || clipRecRef.current?.state === "recording") return
    // No MediaRecorder or no format it can record (older Safari): keep the preview, say that nothing is recorded.
    const mimeType = typeof MediaRecorder === "undefined" ? null : pickRecorderMime(t => MediaRecorder.isTypeSupported(t)) // iOS Safari records mp4
    if (!mimeType) { setRecordIssue(RECORDING_UNSUPPORTED_MESSAGE); return }
    const index = current, chunks: Blob[] = []
    const audio = stream.getAudioTracks().some(t => t.readyState === "live")
    try {
      const mr = new MediaRecorder(stream, { mimeType })
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        // onstop comes late: the next answer's recorder may already be running — only the current one sets the state
        if (clipRecRef.current === mr) setClipRecording(false)
        if (!chunks.length) return
        const type = mr.mimeType || mimeType // the recorder's actual type; else the one it was started with
        const url = URL.createObjectURL(new Blob(chunks, { type }))
        setClips(prev => {
          const next = [...prev]
          next[index] = { url, type, audio }
          return next
        })
      }
      clipRecRef.current = mr
      mr.start()
      setClipRecording(true)
    } catch { setRecordIssue(RECORDING_UNSUPPORTED_MESSAGE) }
  }

  // Ends this answer's recording; its onstop (startClip) saves it.
  function stopClip() {
    const mr = clipRecRef.current
    if (mr?.state !== "recording") return
    try { mr.stop() } catch {}
    setClipRecording(false)
  }

  // 새 질문이 표시되면: (질문 자동 읽기를 켰다면) 면접관이 질문을 읽고 → 답변 시작. 답변 시간은 이때부터 재고,
  // 마이크를 켰다면 이때 듣기 시작한다(읽는 동안 듣지 않아 면접관 음성이 받아 적히지 않는다).
  useEffect(() => {
    if (stage !== "interview" || feedback) return
    qStartRef.current = Date.now()
    answerEndRef.current = null
    spokenRef.current = false
    typedRef.current = false
    answerRef.current = ""
    const text = questions[current]?.question
    // The answer starts once the question has been read, skipped or given up on: the reading is not answer time.
    // A reading cancelled because the answer was submitted or the interview ended never gets here (voice.ts).
    const beginAnswer = () => {
      qStartRef.current = Date.now()
      if (micOnRef.current) speech().start()
    }
    if (autoReadRef.current && text) reader().read(text, beginAnswer)
    else beginAnswer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, current, feedback])

  // 녹화 소리 설정이 녹화 도중 바뀌었다면: 그 녹화가 끝난 뒤 카메라를 새 설정으로 다시 연다(다음 답변부터 적용).
  // Declared before the recording effect, which waits while a change is pending, so no answer starts on the old stream.
  useEffect(() => {
    if (!soundChangePending || clipRecording || !camStream) return
    if (camStream.getAudioTracks().length > 0 === recordAudioRef.current) {
      // toggled back before it applied: nothing to reopen
      setSoundChangePending(false)
      setSoundNotice("")
      return
    }
    void reopenCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundChangePending, clipRecording, camStream])

  // 카메라가 켜져 있으면 답변마다 녹화한다(질문이 열려 있을 때만; 피드백·평가 중에는 녹화하지 않는다).
  // An answer already recorded is not overwritten when the camera is turned on again on the same question.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stage === "interview" && camStream && !feedback && !grading && !clips[current] && !soundChangePending) startClip()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startClip is recreated every render; current is listed
  }, [stage, current, feedback, grading, camStream, clips, soundChangePending])

  // Leaving would lose answers of the interview in progress, or recordings (only in this tab). Closing or reloading the
  // tab asks through beforeunload (browsers may skip it, often on mobile); a click on an in-site link asks here, because
  // client-side navigation fires no beforeunload. Back/forward cannot be asked (popstate cannot be cancelled).
  const inInterview = stage === "interview" || stage === "grading"
  const leaveMessage = leaveWarning({
    // while the report is generated the last answer is already in qa: count a draft only on the interview screen
    answers: inInterview ? qa.length + (stage === "interview" && !feedback && answer.trim() ? 1 : 0) : 0,
    recordings: clips.filter(Boolean).length,
    finished: !inInterview,
  })
  const confirmLeave = () => !leaveMessage || window.confirm(leaveMessage)
  useEffect(() => {
    if (!leaveMessage) return
    let leaving = false // confirmed: a full page load must not ask a second time
    const warn = (e: BeforeUnloadEvent) => { if (leaving) return; e.preventDefault(); e.returnValue = "" }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || !isInSiteLeave({ href: a.href, target: a.target, download: a.hasAttribute("download") }, { button: e.button, modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey }, location.href)) return
      if (window.confirm(leaveMessage)) { leaving = true; return }
      // Capture phase on document: the click never reaches next/link's handler or the browser's default navigation.
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("beforeunload", warn)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", onClick, true)
    }
  }, [leaveMessage])
  useEffect(() => { onLeaveWarningChange?.(leaveMessage) }, [leaveMessage, onLeaveWarningChange])

  // 화면이 바뀌면(새 질문·피드백·결과) 그 화면의 첫 내용으로 포커스를 옮긴다. 누른 버튼이 사라져 포커스가 <body>로
  // 떨어지면 키보드·스크린리더 사용자는 어디에 있는지 잃는다. 모두 사용자의 조작 뒤에만 일어나는 전환이다.
  useEffect(() => {
    const target = stage === "report" ? resultHeadingRef.current
      : stage === "interview" ? (feedback ? feedbackHeadingRef.current : questionRef.current) : null
    target?.focus()
  }, [stage, current, feedback])

  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { clipsRef.current = clips }, [clips])

  // 미러 프리뷰 연결
  useEffect(() => {
    if (camVideoRef.current && camStream) {
      camVideoRef.current.srcObject = camStream
    }
  }, [camStream, stage, current, feedback])

  // 이 기기의 카메라·마이크 유무 — 권한을 묻지 않는 enumerateDevices로 확인하고, 장치를 꽂거나 빼면 다시 확인한다.
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.enumerateDevices) return
    let alive = true
    const check = () => {
      md.enumerateDevices().then(list => {
        // An empty list says nothing (some browsers list no device before a permission): leave it unknown.
        if (alive && list.length) setDevices({ camera: list.some(d => d.kind === "videoinput"), mic: list.some(d => d.kind === "audioinput") })
      }).catch(() => {})
    }
    check()
    md.addEventListener?.("devicechange", check)
    return () => { alive = false; md.removeEventListener?.("devicechange", check) }
  }, [])

  useEffect(() => {
    return () => {
      speechRef.current?.stop()
      readerRef.current?.cancel()
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a request counter, not a DOM node: drop a late camera answer
      camRequestRef.current++
      if (clipRecRef.current) clipRecRef.current.onstop = null // the screen is gone: no new recording to keep
      camStreamRef.current?.getTracks().forEach(t => t.stop())
      clipsRef.current.forEach(c => { if (c) URL.revokeObjectURL(c.url) }) // recordings live only as long as this screen
    }
  }, [])

  // 마이크 켜기/끄기 — 켜는 순간에만 음성 인식을 시작한다. 질문을 읽는 중이면 읽기가 끝난 뒤, 피드백 화면이면
  // 다음 질문에서 시작한다. 끄면 인식을 바로 멈춘다(늦게 오는 결과는 voice.ts가 버린다).
  function toggleMic() {
    if (micOnRef.current) { setMic(false); speech().stop(); return }
    if (speechIssue) {
      // After a failure (no microphone, permission refused) the user may have fixed it: try again with a fresh
      // recognizer. Only on this click — a failed microphone is never turned back on by itself.
      speechRef.current?.stop()
      speechRef.current = null
      setSpeechIssue("")
    }
    setMic(true)
    if (stage === "interview" && !feedback && !grading && !speaking) speech().start()
  }

  function toggleRead() { setRead(!autoReadRef.current) }

  // 카메라 켜기/끄기 — 켜는 순간에만 권한을 묻는다(설정 화면에서 켰다면 면접을 시작할 때). 끄면 이 답변의 녹화를
  // 저장하고 카메라·마이크 트랙을 실제로 해제한다. 권한이 거부돼도 면접은 입력창으로 계속된다.
  async function toggleCamera() {
    if (cameraOn) {
      setCameraOn(false)
      stopClip()
      stopCamera()
      setCamIssue(null)
      return
    }
    setCameraOn(true)
    if (stage !== "settings") await openCamera()
  }

  // 녹화에 소리 포함 켜기/끄기 — '음성 답변'(받아쓰기)과 따로 움직인다. 카메라가 열려 있으면 새 설정으로 다시 여는데,
  // 답변을 녹화하는 중이면 그 녹화는 그대로 두고 끝난 뒤에 적용한다(녹화 중 트랙 교체는 하지 않는다).
  function toggleSound() { changeSound(!recordAudioRef.current) }

  // reason: why the sound setting changed without a click (the recording microphone went away)
  function changeSound(on: boolean, reason = "") {
    setSound(on)
    setSoundNotice(reason)
    if (!camStreamRef.current) return // applied when the camera opens
    if (clipRecRef.current?.state === "recording") {
      setSoundChangePending(true)
      if (!reason) setSoundNotice(on ? "이 답변 녹화는 그대로 두고, 다음 답변부터 소리를 함께 녹화해요." : "이 답변 녹화는 그대로 두고, 다음 답변부터 영상만 녹화해요.")
    } else void reopenCamera().then(() => { if (reason) setSoundNotice(reason) })
  }

  async function reopenCamera() {
    stopCamera() // also clears the pending change and its notice
    await openCamera()
  }

  // 마이크를 켠 동안: 받아적기 초기화 후 재시작 (이전 인식이 끝나면 새로 시작 — voice.ts)
  function retrySpeak() {
    speech().stop()
    answerRef.current = ""
    setAnswer("")
    spokenRef.current = false
    typedRef.current = false
    speech().start()
  }

  // 피드백 후 같은 질문 재도전 (짧은 답변 구제 — 질문 낭비 없음)
  function retryAnswer() {
    setQa(prev => prev.slice(0, current))
    setMetrics(prev => { const n = [...prev]; n[current] = null; return n })
    setClips(prev => { const c = prev[current]; if (c) URL.revokeObjectURL(c.url); const n = [...prev]; n[current] = null; return n })
    answerRef.current = ""
    setAnswer("")
    setFeedback(null)
  }

  // 질문 다시 듣기 — 듣는 동안 마이크를 멈췄다가 읽기가 끝나면 재개(에코로 오인식 방지). 그사이 답변을 제출하거나
  // 면접을 끝내면 읽기가 취소돼 마이크가 다시 켜지지 않는다.
  function replayQuestion() {
    speech().stop()
    reader().read(questions[current]?.question ?? "", () => { if (micOnRef.current) speech().start() })
  }

  // 카메라: 원인별 안내. 마이크는 '녹화에 소리 포함'을 켰을 때만 요청한다. 마이크만 거부·없음이면 영상만 녹화하고
  // 그 사실을 알린다(답변은 입력창으로 가능).
  // 권한 응답이 면접 종료(stopCamera) 뒤나 더 새로운 요청 뒤에 오면, 받은 장치를 바로 해제하고 버린다.
  async function openCamera(): Promise<boolean> {
    const request = ++camRequestRef.current
    const stale = () => request !== camRequestRef.current
    setCamIssue(null)
    const pre = mediaSupportIssue({ isSecureContext: window.isSecureContext, hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia })
    if (pre) { setCamIssue(pre); return false }
    const video = { width: { ideal: 1280 }, facingMode: "user" }
    const withSound = recordAudioRef.current
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: withSound })
    } catch (err) {
      if (stale()) return false
      const issue = classifyMediaError(err)
      if (!withSound || (issue !== "denied" && issue !== "no-device")) { setCamIssue(issue); return false }
      try { stream = await navigator.mediaDevices.getUserMedia({ video }) } catch (err2) { if (!stale()) setCamIssue(classifyMediaError(err2)); return false }
      if (!stale()) {
        setSound(false)
        setSoundNotice("마이크를 쓸 수 없어 소리 없이 영상만 녹화해요. 면접은 그대로 계속돼요.")
      }
    }
    if (stale()) { stream.getTracks().forEach(t => t.stop()); return false }
    // A device that stops during the interview (unplugged, taken by another app, permission revoked). Our own
    // track.stop() fires no "ended"; the stream check skips a camera already closed. Turning it back on is the user's choice.
    stream.getVideoTracks().forEach(t => t.addEventListener("ended", () => {
      if (camStreamRef.current !== stream) return
      stopClip() // this answer's recording so far is saved (Chrome may already have stopped the recorder)
      stopCamera()
      setCamIssue("disconnected")
    }))
    stream.getAudioTracks().forEach(t => t.addEventListener("ended", () => {
      if (camStreamRef.current !== stream) return
      changeSound(false, "녹화용 마이크 연결이 끊겼어요. 이 답변의 녹화는 그대로 두고, 다음 답변부터 영상만 녹화해요.")
    }))
    camStreamRef.current = stream
    setCamStream(stream)
    return true
  }

  function markAiOff(kind: "paused" | "quota") {
    aiOffRef.current = kind
    setAiOff(kind)
    setNotice(kind === "paused"
      ? "지금은 AI 기능이 중지되어 있어 AI 피드백과 종합 평가 없이 진행해요. 답변 기록과 참고 지표는 결과 화면에서 볼 수 있어요."
      : "오늘 AI 사용 한도에 도달해 AI 피드백과 종합 평가 없이 진행해요. 답변 기록과 참고 지표는 결과 화면에서 볼 수 있어요.")
  }

  // The previous result (answers, recordings, metrics, AI state) is replaced only once the new questions have arrived:
  // a failed request returns to it intact, with no camera left on for an interview that never started.
  async function start(prevStage: Stage = "settings") {
    setError("")
    setStage("loading")

    // 카메라를 켜 두었다면: 권한 + 스트림 (실패해도 면접은 진행 — 원인과 다음 행동을 화면에 안내)
    const openedCamera = cameraOn && !camStreamRef.current ? await openCamera() : false

    try {
      let newQuestions: Question[]
      let fallback: unknown = null
      if (onRetry) {
        // prep 모드: 커스텀 질문 재생성 (onRetry는 PrepInterviewClient가 주입)
        newQuestions = await onRetry()
      } else {
        const res = await fetch("/api/interview/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, count }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.questions?.length) throw Object.assign(new Error("questions"), { status: res.status, code: data.code })
        newQuestions = data.questions
        fallback = data.fallback
      }
      // The new interview is certain from here: release the previous result.
      clips.forEach(c => { if (c) URL.revokeObjectURL(c.url) })
      setClips([])
      setMetrics([])
      setReportFailure(null)
      setNotice("")
      aiOffRef.current = null
      setAiOff(null)
      if (fallback === "paused") markAiOff("paused")
      else if (fallback) setNotice(fallback === "budget"
        ? "지금은 AI 질문을 만들 수 없어 최근 MarkLens 기사와 기본 질문으로 진행해요. AI 피드백은 답변마다 다시 시도해요."
        : "AI 질문 생성이 지연돼 최근 MarkLens 기사와 기본 질문으로 진행해요.")
      setQuestions(newQuestions)
      setCurrent(0)
      setAnswer("")
      setFeedback(null)
      setQa([])
      setReport(null)
      setStage("interview")
    } catch (err) {
      const { status = null, code } = err as { status?: number; code?: unknown }
      if (openedCamera) stopCamera()
      setStage(prevStage)
      setError(apiFailureMessage("questions", status, navigator.onLine, code))
    }
  }

  // 스피치 지표 측정 — 이 질문의 답변 시간·글자 수·필러 단어 (브라우저에서만 계산)
  // 답변 시간은 처음 제출한 시점까지: 실패한 피드백 요청을 다시 보내도 늘어나지 않는다.
  function recordMetrics(text: string) {
    const end = answerEndRef.current ??= Date.now()
    const m: AnswerMetrics = {
      sec: Math.round((end - qStartRef.current) / 1000),
      chars: text.replace(/\s/g, "").length,
      fillers: countFillers(text),
      input: spokenRef.current ? (typedRef.current ? "mixed" : "voice") : "text",
    }
    setMetrics(prev => {
      const next = [...prev]
      next[current] = m
      return next
    })
  }

  // 여기까지 하고 결과 보기: 기록된 답변과 작성 중인 답변으로 결과 화면에 간다. 답변이 하나도 없으면 아무 일도 하지 않는다.
  async function finishEarly() {
    const draft = feedback ? "" : answer.trim() // with feedback on screen, this answer is already recorded
    const entries = draft ? [...qa, { question: questions[current].question, answer: draft, feedback: null }] : qa
    if (!entries.length || grading) return
    speech().stop() // its late results are ignored and it does not restart
    if (draft) { stopClip(); recordMetrics(draft) } // keep this answer's recording; stopCamera discards an unused one
    setQa(entries)
    setFeedbackFailed(false)
    setError("")
    await generateReport(entries) // stops camera, recording and question speech
  }

  async function submitAnswer() {
    if (!answer.trim() || grading) return
    speech().stop() // late results of this answer must not reach the next one
    reader().cancel() // a replayed question must not reopen the microphone after this answer
    setReadingNotice("") // it was about this question's reading
    stopClip() // 화상 모드: 이 답변의 녹화 저장
    recordMetrics(answer)

    setError("")
    setFeedbackFailed(false)
    const q = questions[current]
    // AI known to be stopped (or out of quota) in this session: keep the answer, skip the request that cannot succeed.
    if (aiOffRef.current) {
      await advanceWith([...qa, { question: q.question, answer, feedback: null }])
      return
    }
    setGrading(true)
    try {
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, answer, role, context: feedbackContext }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.improve) throw Object.assign(new Error("feedback"), { status: res.status, code: data.code })
      setFeedback(data)
      setQa(prev => [...prev, { question: q.question, answer, feedback: data }])
    } catch (err) {
      const { status = null, code } = err as { status?: number; code?: unknown }
      const kind = aiFailureKind(status, code, navigator.onLine)
      if (aiOffForSession(kind)) {
        markAiOff(kind as "paused" | "quota")
        await advanceWith([...qa, { question: q.question, answer, feedback: null }])
      } else {
        setError(apiFailureMessage("feedback", status, navigator.onLine, code))
        setFeedbackFailed(true) // 다시 제출하거나, 피드백 없이 다음 질문으로 넘어갈 수 있다
      }
    } finally {
      setGrading(false)
    }
  }

  // Record the answers so far and move to the next question, or to the result screen after the last one.
  async function advanceWith(entries: QaEntry[]) {
    setQa(entries)
    setFeedbackFailed(false)
    setError("")
    if (current + 1 >= questions.length) {
      await generateReport(entries) // state is not updated yet in this call — pass the entries explicitly
    } else {
      setCurrent(current + 1)
      setAnswer("")
      setFeedback(null)
    }
  }

  // 피드백 생성이 실패해도 면접이 멈추지 않게: 답변은 기록하고 다음 질문(또는 리포트)으로
  async function skipFeedback() {
    await advanceWith([...qa, { question: questions[current].question, answer, feedback: null }])
  }

  // The result screen shows the local record (answers, feedback received, metrics, recordings) whatever happens
  // here; the AI summary is only added when it was really generated.
  async function generateReport(entries = qa) {
    if (reportBusyRef.current) return // one request at a time
    speech().stop() // 면접 종료 — 음성 인식이 다시 켜지지 않게
    reader().cancel() // 읽던 질문이 끝나도 마이크를 다시 켜지 않게
    stopCamera() // 면접 종료 — 카메라 해제 (녹화 클립은 유지)
    setReport(null)
    setReportFailure(null)
    if (aiOffRef.current) {
      setReportFailure({ message: apiFailureMessage("report", null, true, aiOffRef.current === "paused" ? "ai_paused" : "ai_quota"), retry: false })
      setStage("report")
      return
    }
    reportBusyRef.current = true
    setStage("grading")
    try {
      const res = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, qa: entries.map(({ question, answer }) => ({ question, answer })), companyName: externalCompanyName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.summary) throw Object.assign(new Error("report"), { status: res.status, code: data.code })
      setReport(data)
    } catch (err) {
      const { status = null, code } = err as { status?: number; code?: unknown }
      const kind = aiFailureKind(status, code, navigator.onLine)
      if (aiOffForSession(kind)) markAiOff(kind as "paused" | "quota")
      setReportFailure({ message: apiFailureMessage("report", status, navigator.onLine, code), retry: !aiOffForSession(kind) })
    } finally {
      reportBusyRef.current = false
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

  // 카메라·마이크·질문 읽기 — 설정 화면과 면접 화면이 같은 버튼을 쓴다(맞춤 면접도 면접 화면에서 켤 수 있다).
  const toggleClass = (on: boolean) => `flex-1 min-w-[6.5rem] py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-40 ${on ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`
  const inSettings = stage === "settings"
  const cameraState = !cameraOn ? "꺼짐" : inSettings ? "켜짐" : camStream ? (clipRecording ? "녹화 중" : recordIssue ? "녹화 불가" : "켜짐") : camIssue ? "연결 안 됨" : "연결 중…"
  // after a failure the toggle stays usable: turning it on again is how a fixed microphone is tried
  const micState = !speechSupported ? "지원 안 됨" : !micOn ? (speechIssue ? "꺼짐 · 오류" : "꺼짐") : recording ? "듣는 중" : "켜짐"
  const streamHasSound = !!camStream && camStream.getAudioTracks().length > 0
  const deviceToggles = (
    <div className="space-y-2">
      <div role="group" aria-label="면접 장치 설정" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={cameraOn} onClick={() => { void toggleCamera() }} className={toggleClass(cameraOn)}>
          <span aria-hidden="true">📷 </span>카메라 녹화 <span className="font-normal opacity-80">· {cameraState}</span>
        </button>
        <button type="button" aria-pressed={micOn} onClick={toggleMic} disabled={!speechSupported || grading} className={toggleClass(micOn)}>
          <span aria-hidden="true">🎙 </span>음성 답변 <span className="font-normal opacity-80">· {micState}</span>
        </button>
        <button type="button" aria-pressed={autoRead} onClick={toggleRead} disabled={!readingSupported} className={toggleClass(autoRead)}>
          <span aria-hidden="true">🔊 </span>질문 자동 읽기 <span className="font-normal opacity-80">· {!readingSupported ? "지원 안 됨" : autoRead ? "켜짐" : "꺼짐"}</span>
        </button>
      </div>
      {/* 카메라의 하위 옵션 — 녹화용 마이크. '음성 답변'(받아쓰기)과는 따로 켜고 끈다 */}
      {cameraOn && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" aria-pressed={recordAudio} onClick={toggleSound}
            className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${recordAudio ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
            <span aria-hidden="true">🔈 </span>녹화에 소리 포함 <span className="font-normal opacity-80">· {recordAudio ? "켜짐" : "꺼짐"}</span>
          </button>
          <span className="text-xs text-gray-400">카메라 녹화용 마이크예요. ‘음성 답변’과는 따로 켜고 꺼요.</span>
        </div>
      )}
      {soundNotice && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{soundNotice}</p>}
      {/* 켜기 전에 무엇이 어디로 가는지 — 설정 화면과 면접 화면(맞춤 면접 포함) 모두에서 보인다. 코드가 하는 일만 적는다:
          녹화는 Blob URL로만 있고 업로드하지 않는다. 음성 인식은 브라우저 기능이라 처리 위치를 MarkLens가 보장하지 않는다. */}
      {cameraOn && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          🔒 녹화 영상은 이 브라우저 안에만 있어요. 서버로 보내지 않고, 이 화면을 떠나거나 탭을 닫으면 사라져요. 소리는 ‘녹화에 소리 포함’을 켰을 때만 녹음해요.{inSettings ? " 권한은 면접을 시작할 때 물어요." : ""}
        </p>
      )}
      {micOn && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          🎙 음성 답변은 브라우저의 음성 인식 기능으로 받아 적어요. 브라우저에 따라 음성이 브라우저 회사의 서버로 보내져 처리될 수 있어요. MarkLens는 음성을 받지 않고, 받아 적힌 글만 입력한 답변과 똑같이 다뤄요. 마이크를 쓸 수 없으면 저절로 꺼지고 입력창으로 계속돼요.
        </p>
      )}
      {autoRead && inSettings && (
        <p className="text-xs text-gray-500 dark:text-gray-400">🔊 질문을 읽은 뒤부터 답변 시간을 재요. 읽는 중에는 질문 옆 버튼으로 멈출 수 있어요.</p>
      )}
      {!speechSupported && <p className="text-xs text-amber-700 dark:text-amber-400">이 브라우저는 음성 인식을 지원하지 않아 답변은 입력창에 써 주세요. 음성 답변은 Chrome·Edge에서 지원돼요.</p>}
      {!readingSupported && <p className="text-xs text-amber-700 dark:text-amber-400">이 브라우저는 질문 읽기를 지원하지 않아요. 질문은 화면에서 확인할 수 있어요.</p>}
      {/* 이 기기에 없는 장치 — 권한 없이 확인한 결과라 켜는 것은 막지 않는다(목록이 틀릴 수도 있다) */}
      {devices && !devices.camera && <p className="text-xs text-amber-700 dark:text-amber-400">이 기기에서 카메라를 찾지 못했어요. 카메라 없이 입력창으로 진행할 수 있어요.</p>}
      {devices && !devices.mic && <p className="text-xs text-amber-700 dark:text-amber-400">이 기기에서 마이크를 찾지 못했어요. 음성 답변과 녹화 소리 없이 입력창으로 답할 수 있어요.</p>}
    </div>
  )

  // ── 설정 ──
  if (stage === "settings") return (
    <div className="space-y-8">
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">지원 직무</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {ROLES.map(r => (
            <button key={r.key} aria-pressed={role === r.key} onClick={() => setRole(r.key)}
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
            <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-all ${count === n ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {n}문항 (~{n * 3}분)
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">카메라·마이크·질문 읽기 <span className="font-normal text-gray-400">(선택)</span></p>
        <p className="text-xs text-gray-400 mb-3">답변은 언제나 입력창에 쓸 수 있어요. 필요한 것만 켜세요 — 면접 중에도 바꿀 수 있어요.</p>
        {deviceToggles}
      </div>

      <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        💡 최근 마케팅 트렌드를 인용한 질문이 섞여 나와요. 실제 면접처럼 소리 내어 답해보세요.
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        🔐 {AI_DATA_NOTICE} <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>
      </p>

      <button onClick={() => start("settings")}
        className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold hover:opacity-90 transition-opacity">
        면접 시작하기
      </button>
    </div>
  )

  // ── 로딩 ──
  if (stage === "loading") return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div aria-hidden="true" className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p role="status" className="text-gray-500 text-base">면접관이 질문을 준비하고 있어요...</p>
    </div>
  )

  // ── 면접 진행 ──
  if (stage === "interview" && q) return (
    <div>
      {error && <p role="alert" className="text-sm text-red-500 mb-4">{error}</p>}
      {feedbackFailed && !feedback && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={submitAnswer} disabled={grading}
            className="px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-40">다시 제출</button>
          <button onClick={skipFeedback} disabled={grading}
            className="px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold disabled:opacity-40">
            피드백 없이 {current + 1 >= questions.length ? "리포트 보기" : "다음 질문"}
          </button>
        </div>
      )}
      {notice && <p role="status" className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{notice}</p>}
      {isPrepMode && current === 0 && !feedback && (
        <div className="mb-5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          💡 맞춤 면접 질문이에요. 자기소개서 경험을 구체적으로 답해보세요.
          {speechSupported ? " 마이크로 소리 내어 말하면 더 효과적이에요." : ""}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="ml-career-progress text-sm text-gray-400 font-medium">Question {String(current + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span>
        <span className="text-sm text-gray-400">{KIND_LABEL[q.kind] ?? ""}</span>
      </div>
      <div aria-hidden="true" className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mb-8">
        <div className="h-full bg-black dark:bg-white rounded-full transition-all"
          style={{ width: `${((current + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {/* 카메라·마이크·질문 읽기 — 면접 중에도 켜고 끌 수 있다. 무엇을 켜든 끄든 답변은 입력창으로 계속된다. */}
      <div className="mb-3">{deviceToggles}</div>
      {speechIssue && <p role="status" className="mb-3 text-sm text-amber-700 dark:text-amber-400">{speechIssue} 마이크를 연결하거나 권한을 허용했다면 ‘음성 답변’을 다시 켜 보세요.</p>}
      {/* 지금 일어나는 일 — 읽는 중 / 듣는 중 / 녹화 중 (스크린리더에도 알린다) */}
      <p role="status" className="mb-4 min-h-[1.25rem] text-xs font-semibold text-gray-500 dark:text-gray-400">
        {[speaking && "🔊 질문을 읽고 있어요", recording && "🎙 듣고 있어요 — 말한 내용이 입력창에 적혀요", clipRecording && (streamHasSound ? "● 녹화 중 (영상·소리, 이 브라우저에만 저장)" : "● 녹화 중 (영상만, 이 브라우저에만 저장)")].filter(Boolean).join(" · ")}
      </p>

      {cameraOn && (camStream ? (
        <div className="relative w-full sm:max-w-sm mb-5 rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          {recordIssue && <p role="status" className="absolute bottom-0 inset-x-0 bg-black/70 px-3 py-2 text-xs text-white">{recordIssue}</p>}
          <video ref={camVideoRef} autoPlay muted playsInline aria-label="내 카메라 미리보기"
            className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {clipRecording && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/70 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
            </span>
          )}
        </div>
      ) : camIssue ? (
        <div role="alert" className="mb-5 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">{MEDIA_MESSAGES[camIssue].title}</p>
          <p className="mt-1 text-amber-800/80 dark:text-amber-300/80 leading-relaxed">{MEDIA_MESSAGES[camIssue].action} 답변은 입력창으로 계속할 수 있어요.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {camIssue !== "insecure" && camIssue !== "unsupported" && (
              <button onClick={() => { void openCamera() }} className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">다시 시도</button>
            )}
            <button onClick={() => { void toggleCamera() }} className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">카메라 끄고 계속</button>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-gray-400">카메라 연결 중… 권한을 묻는 창이 보이면 허용하거나, 위의 ‘카메라 녹화’를 눌러 끌 수 있어요.</p>
      ))}

      {/* 면접관 질문 — 질문은 항상 화면에 보인다(소리가 안 나오는 기기·청각 사용자도). 🔊로 듣고, 읽는 중에는 멈출 수 있다. */}
      <div className="ml-interview-question rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🧑‍💼</span>
          <p ref={questionRef} tabIndex={-1} className="ml-career-question text-lg font-semibold text-gray-900 dark:text-gray-100 leading-relaxed flex-1 focus:outline-none"><span className="sr-only">질문 {current + 1}/{questions.length}: </span>{q.question}</p>
          {readingSupported && <button onClick={() => { if (speaking) reader().skip(); else replayQuestion() }} disabled={grading} aria-label={speaking ? "질문 읽기 멈추기" : "질문 듣기"}
            className="flex-shrink-0 inline-flex items-center gap-1 p-2 rounded-lg text-sm font-semibold text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-40">
            {speaking ? <><VolumeX className="w-4 h-4" /> 멈추기</> : <Volume2 className="w-4 h-4" />}
          </button>}
        </div>
      </div>

      {readingNotice && <p role="status" className="mb-4 text-sm text-amber-700 dark:text-amber-400">{readingNotice}</p>}

      {/* 답변 — 입력창은 언제나 있다. 마이크로 듣는 동안은 받아 적은 글이 여기에 보이고(그동안은 읽기 전용), 끄면 고칠 수 있다. */}
      {!feedback && (
        <div className="space-y-3">
          <textarea
            aria-label="면접 답변"
            aria-describedby={recording ? "interview-answer-hint" : undefined}
            value={answer}
            onChange={e => { typedRef.current = true; setAnswer(e.target.value) }}
            readOnly={recording}
            disabled={grading}
            rows={5}
            placeholder={recording ? "듣고 있어요... 말씀하세요 🎙" : micOn ? "말하거나 입력하세요" : "답변을 입력하세요"}
            className={`w-full px-5 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-base leading-relaxed focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-60 resize-none ${recording ? "bg-gray-50 dark:bg-gray-900/60" : "bg-white dark:bg-gray-900"}`}
          />
          {recording && <p id="interview-answer-hint" className="text-xs text-gray-400">말하는 동안은 받아 적기만 해요. 글을 고치려면 ‘음성 답변’을 끄세요.</p>}
          <div className="flex gap-2">
            {micOn && !speechIssue && (
              <button onClick={retrySpeak} disabled={grading || speaking}
                className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap disabled:opacity-40">
                🔁 다시 말하기
              </button>
            )}
            <button onClick={submitAnswer} disabled={!answer.trim() || grading}
              className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {grading ? <><Loader2 className="w-4 h-4 animate-spin" /> 면접관이 평가 중...</> : aiOff ? "답변 저장하고 다음으로" : "답변 제출"}
            </button>
          </div>
        </div>
      )}

      {/* 질문별 피드백 */}
      {feedback && (
        <div className="space-y-4">
          <h2 ref={feedbackHeadingRef} tabIndex={-1} className="sr-only">질문 {current + 1} 피드백</h2>
          {/* 스피치 지표 + STAR 구조 */}
          <div className="flex flex-wrap items-center gap-2">
            {metrics[current] && (
              <>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  ⏱ {metrics[current].sec >= 60 ? `${Math.floor(metrics[current].sec / 60)}분 ${metrics[current].sec % 60}초` : `${metrics[current].sec}초`}
                </span>
                {metrics[current].input === "voice" && metrics[current].sec >= 5 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    🗣 분당 {Math.round(metrics[current].chars / (metrics[current].sec / 60))}자 {(() => { const v = Math.round(metrics[current].chars / (metrics[current].sec / 60)); return v > 400 ? "(빠른 편)" : v < 200 ? "(느린 편)" : "(보통)" })()} · 참고
                  </span>
                )}
                {metrics[current].input === "voice" && metrics[current].fillers > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    🤔 필러로 잡힌 단어 {metrics[current].fillers}회 · 참고
                  </span>
                )}
                {metrics[current].input === "mixed" && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    🗣 말하고 고친 답변 — 말속도는 계산하지 않아요
                  </span>
                )}
              </>
            )}
            {feedback.star && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                {/* the filled letters carry the meaning by colour alone: say it in words for screen readers */}
                <span className="sr-only">STAR 구조: {(["s", "t", "a", "r"] as const).map(k => `${STAR_LABEL[k]} ${feedback.star![k] ? "있음" : "없음"}`).join(", ")}</span>
                <span aria-hidden="true" className="inline-flex items-center gap-1">
                  STAR
                  {(["s", "t", "a", "r"] as const).map(k => (
                    <span key={k} title={`${STAR_LABEL[k]} ${feedback.star![k] ? "있음" : "없음"}`} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${feedback.star![k] ? "bg-indigo-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
                      {k.toUpperCase()}
                    </span>
                  ))}
                </span>
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

      {/* 중간 종료 — 답변이 하나라도 있을 때만 (빈 결과를 완료한 면접처럼 보여 주지 않는다) */}
      {(qa.length > 0 || (!feedback && !!answer.trim())) && !(feedback && current + 1 >= questions.length) && (
        <button onClick={finishEarly} disabled={grading}
          className="mt-6 w-full py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 underline underline-offset-4 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40">
          여기까지 하고 결과 보기
        </button>
      )}
    </div>
  )

  // ── 리포트 생성 중 ──
  if (stage === "grading") return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div aria-hidden="true" className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p role="status" className="text-gray-500 text-base">면접 전체를 평가하고 있어요...</p>
    </div>
  )

  // ── 종합 리포트 ──
  if (stage === "report") return (
    <div>
      <h2 ref={resultHeadingRef} tabIndex={-1} className="sr-only">면접 결과</h2>
      {/* e.g. "새 질문으로 다시" failed: the error must be visible here, not only on the interview screen */}
      {error && <p role="alert" className="text-sm text-red-500 mb-4">{error}</p>}
      {/* AI 종합 평가 — 실제로 생성됐을 때만. 없으면 이유와, 다시 요청해서 나아질 수 있을 때만 재시도 버튼 */}
      {!report && (
        <div className="text-center py-10 border border-gray-100 dark:border-gray-800 rounded-2xl mb-6 px-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{role}{isPrepMode ? " · 맞춤 면접 기록" : " · 모의면접 기록"}</p>
          <p className="text-base font-bold text-gray-700 dark:text-gray-300 mb-2">AI 종합 평가 없이 면접 기록을 정리했어요</p>
          {reportFailure && <p role="status" className="text-sm text-gray-500 leading-relaxed">{reportFailure.message}</p>}
          {reportFailure?.retry && (
            <button onClick={() => generateReport()}
              className="mt-5 px-6 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> AI 종합 평가 다시 받기
            </button>
          )}
        </div>
      )}
      {report && (
        <div className="text-center py-10 border border-gray-100 dark:border-gray-800 rounded-2xl mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{role}{isPrepMode ? " · 맞춤 면접 결과" : " · 모의면접 결과"}</p>
          <p className="text-6xl font-black text-gray-900 dark:text-gray-100 mb-2">{report.score}<span className="text-3xl text-gray-400">점</span></p>
          <p className="text-gray-500 text-base px-8 leading-relaxed">{report.summary}</p>
        </div>
      )}

      {/* 스피치 요약 (음성/화상 답변이 있을 때) */}
      {metrics.some(Boolean) && (() => {
        const ms = metrics.filter((m): m is AnswerMetrics => !!m)
        const avgSec = Math.round(ms.reduce((a, m) => a + m.sec, 0) / ms.length)
        // speaking rate and fillers only from answers given entirely by voice: typed or edited text was not spoken
        const spoken = ms.filter(m => m.input === "voice")
        const voiced = spoken.filter(m => m.sec >= 5)
        const avgRate = voiced.length ? Math.round(voiced.reduce((a, m) => a + m.chars / (m.sec / 60), 0) / voiced.length) : null
        const totalFillers = spoken.length ? spoken.reduce((a, m) => a + m.fillers, 0) : null
        return (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">🎙 답변 참고 지표</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{avgSec >= 60 ? `${Math.floor(avgSec / 60)}분+` : `${avgSec}초`}</p>
                <p className="text-xs text-gray-400 mt-0.5">평균 답변 시간</p>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{avgRate ? `${avgRate}자` : "—"}</p>
                <p className="text-xs text-gray-400 mt-0.5">분당 글자 수 {avgRate ? (avgRate > 400 ? "(빠른 편)" : avgRate < 200 ? "(느린 편)" : "(보통)") : "(음성 답변 없음)"}</p>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{totalFillers === null ? "—" : `${totalFillers}회`}</p>
                <p className="text-xs text-gray-400 mt-0.5">필러로 잡힌 단어{totalFillers === null ? " (음성 답변 없음)" : ""}</p>
              </div>
            </div>
            {/* Heuristics on the transcript and the clock — say so, so they are not read as voice analysis. */}
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              답변 글자 수와 시간으로 계산한 참고 값이에요. 목소리·발음은 분석하지 않아요.
              말속도와 필러는 음성으로만 답한 답변에서 계산하고, 타이핑하거나 받아 적은 뒤 고친 답변은 빼요.
              필러는 &lsquo;음·어·그·이제·막&rsquo; 같은 단어를 센 것이라, 음성 인식이 지운 필러는 빠지고 일반 단어로 쓴 경우도 함께 세요.
            </p>
          </div>
        )
      })()}

      {report && (
        <>
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
              <span role="status" className="sr-only">{copied ? "한 마디를 복사했어요" : ""}</span>
            </div>
          )}
        </>
      )}

      {/* 내 답변 기록 — AI 결과와 무관하게 항상: 질문, 답변, 받은 피드백, 답변 시간, 녹화 */}
      {qa.length > 0 ? (
        <section className="mb-6" aria-labelledby="interview-record">
          <h2 id="interview-record" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">📝 내 답변 기록</h2>
          <p className="text-xs text-gray-400 mb-4">
            {qa.length}/{questions.length}문항 답변 · 이 기록은 MarkLens에 저장되지 않아 이 화면을 떠나거나 탭을 닫으면 사라져요.
            {clips.some(Boolean) ? " 영상은 이 브라우저에만 있으니 보관하려면 ‘영상 저장’으로 내려받으세요." : ""}
          </p>
          <ol className="space-y-4">
            {qa.map((entry, i) => (
              <li key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-relaxed">Q{i + 1}. {entry.question}</p>
                {metrics[i] && <p className="text-xs text-gray-400 mt-1">⏱ 답변 시간 {formatDuration(metrics[i]!.sec)}</p>}
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{entry.answer}</p>
                {entry.feedback ? (
                  <div className="mt-4 space-y-2 text-sm leading-relaxed">
                    {entry.feedback.good?.trim() && <p><span className="font-bold text-emerald-700 dark:text-emerald-400">👍 잘한 점 </span>{entry.feedback.good}</p>}
                    <p><span className="font-bold text-amber-700 dark:text-amber-400">🔧 아쉬운 점 </span>{entry.feedback.improve}</p>
                    <p><span className="font-bold text-gray-500">💬 이렇게 답하면 더 좋아요 </span>{entry.feedback.model_answer}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-400">이 답변에는 AI 피드백이 없어요.</p>
                )}
                {clips[i] && (() => {
                  const clip = clips[i]!, ext = recordingExtension(clip.type)
                  return (
                    <div className="mt-4">
                      <video src={clip.url} controls playsInline aria-label={`답변 ${i + 1} 녹화, ${clip.audio ? "소리 포함" : "소리 없음"}`} className="w-full aspect-video object-cover bg-black" />
                      <p className="mt-2 text-xs text-gray-500">{clip.audio ? "🔈 소리 포함" : "🔇 소리 없음 · 영상만 녹화"}</p>
                      <a href={clip.url} download={`marklens-면접답변-${i + 1}${ext ? `.${ext}` : ""}`}
                        className="inline-flex items-center min-h-[44px] pr-3 text-sm font-semibold text-indigo-600 hover:underline">
                        영상 저장{ext ? ` (${ext.toUpperCase()})` : ""}
                      </a>
                    </div>
                  )
                })()}
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="mb-6 text-sm text-gray-500">기록된 답변이 없어요.</p>
      )}

      {report && (
        <button onClick={shareReport}
          className="w-full mb-3 py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
          <Share2 className="w-5 h-5" /> 결과 공유하기
        </button>
      )}

      <div className="flex gap-3">
        {/* 새 면접은 질문을 받은 뒤에 이 결과를 대신한다. 영상이 사라지므로 먼저 묻는다. */}
        <button onClick={() => { if (confirmLeave()) void start("report") }}
          className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> {isPrepMode ? "새 질문으로 다시" : "같은 직무로 다시"}
        </button>
        <button onClick={() => {
          if (!confirmLeave()) return
          stopCamera()
          if (onGoBack) onGoBack() // prep: this component unmounts and its cleanup releases the recordings
          else {
            clips.forEach(c => { if (c) URL.revokeObjectURL(c.url) })
            setClips([])
            setStage("settings")
          }
        }}
          className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity">
          {isPrepMode ? "정보 다시 입력" : "직무 바꾸기"}
        </button>
      </div>
      <Link href="/learn" className="ml-career-next">다른 트렌드 훈련하기 →</Link>
    </div>
  )

  return null
}
