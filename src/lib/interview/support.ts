// Interview (Career Lab) browser support and failure messages. Every failure tells the user what happened and what to
// do next, instead of leaving a spinner or a disabled button (2026-10-27 quality audit: "화상 면접이 작동하지 않는다").

export type MediaIssue = "insecure" | "unsupported" | "denied" | "no-device" | "in-use" | "disconnected" | "unknown"

export interface MediaEnv { isSecureContext?: boolean; hasGetUserMedia?: boolean }

/** Camera/microphone can only be requested on HTTPS (or localhost) in browsers that expose getUserMedia. */
export function mediaSupportIssue(env: MediaEnv): MediaIssue | null {
  if (env.isSecureContext === false) return "insecure"
  if (!env.hasGetUserMedia) return "unsupported"
  return null
}

/** getUserMedia rejects with a DOMException whose name says why. */
export function classifyMediaError(err: unknown): MediaIssue {
  const name = (err as { name?: string })?.name ?? ""
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied"
  if (name === "SecurityError") return "insecure"
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-device"
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "in-use"
  if (name === "TypeError") return "unsupported"
  return "unknown"
}

export const MEDIA_MESSAGES: Record<MediaIssue, { title: string; action: string }> = {
  insecure: { title: "보안 연결(HTTPS)에서만 카메라를 쓸 수 있어요.", action: "https://marklens.site 주소로 다시 접속해 주세요." },
  unsupported: { title: "이 브라우저는 카메라 연결을 지원하지 않아요.", action: "최신 Chrome·Edge·Safari에서 열거나, 카메라를 끄고 진행하세요." },
  denied: { title: "카메라 또는 마이크 권한이 꺼져 있어요.", action: "주소창 왼쪽 자물쇠 아이콘 → 카메라·마이크 허용 후 '다시 시도'를 눌러 주세요." },
  "no-device": { title: "연결된 카메라를 찾지 못했어요.", action: "카메라를 연결한 뒤 '다시 시도'를 누르거나, 카메라를 끄고 진행하세요." },
  "in-use": { title: "다른 앱이 카메라를 사용 중이에요.", action: "화상회의 등 카메라를 쓰는 앱을 닫고 '다시 시도'를 눌러 주세요." },
  // the camera stopped during the interview (unplugged, taken by another app, permission revoked)
  disconnected: { title: "카메라 연결이 끊겼어요.", action: "그때까지 녹화한 부분은 저장했어요. 카메라를 다시 연결한 뒤 '다시 시도'를 누르세요." },
  unknown: { title: "카메라를 시작하지 못했어요.", action: "'다시 시도'를 누르거나, 카메라를 끄고 진행하세요." },
}

/** The browser has no MediaRecorder or no format it can record: the preview works, nothing is recorded. */
export const RECORDING_UNSUPPORTED_MESSAGE = "이 브라우저는 영상 녹화를 지원하지 않아 미리보기만 보여요. 면접은 그대로 진행돼요."

/** Web Speech API error codes. A fatal one must stop the automatic restart (it would loop forever). */
export function classifySpeechError(code: string): { fatal: boolean; message: string } {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return { fatal: true, message: "마이크 권한이 꺼져 있어 음성 답변을 받을 수 없어요. 아래 입력창에 직접 답해 주세요." }
    case "audio-capture":
      return { fatal: true, message: "마이크를 찾지 못했어요. 아래 입력창에 직접 답해 주세요." }
    case "network":
      return { fatal: true, message: "음성 인식 서버에 연결하지 못했어요. 아래 입력창에 직접 답해 주세요." }
    case "language-not-supported":
      return { fatal: true, message: "이 브라우저는 한국어 음성 인식을 지원하지 않아요. 아래 입력창에 직접 답해 주세요." }
    default: // "no-speech", "aborted" — normal pauses
      return { fatal: false, message: "" }
  }
}

/** First recording format the browser supports (iOS Safari records mp4, not webm); null = record nothing. */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string | null {
  for (const type of ["video/webm;codecs=vp9", "video/webm", "video/mp4"]) if (isTypeSupported(type)) return type
  return null
}

/** Why an interview AI call failed. `code` is the stable code from the AI budget check (src/lib/ai/budget.ts); a bare
 *  status cannot tell an operator stop from a temporary outage (both can be 503). */
export type AiFailure = "offline" | "paused" | "quota" | "rate" | "unavailable" | "failed"
export function aiFailureKind(status: number | null, code: unknown, online: boolean): AiFailure {
  if (!online) return "offline"
  if (code === "ai_paused") return "paused"
  if (code === "ai_quota") return "quota"
  if (status === 429) return "rate" // per-minute request limit
  if (status === 503 || code === "ai_unavailable") return "unavailable"
  return "failed" // AI provider error or bad answer
}

/** A stop or a spent daily quota will not clear during this interview: retrying only repeats the failure. */
export const aiOffForSession = (kind: AiFailure) => kind === "paused" || kind === "quota"

/** File extension for a recording, from the type the browser actually produced (MediaRecorder.mimeType). No
 *  conversion happens, so an unknown type gets no extension rather than a guessed one. */
export function recordingExtension(mimeType: string): string | null {
  const type = mimeType.split(";")[0].trim().toLowerCase()
  if (type === "video/webm") return "webm"
  if (type === "video/mp4") return "mp4"
  if (type === "video/x-matroska") return "mkv" // some Chrome versions report webm-requested H.264 recordings this way
  return null
}

/** Shown when the question reading neither ended nor failed in time (see readingTimeoutMs in voice.ts). */
export const READING_TIMEOUT_MESSAGE = "질문 읽기가 응답하지 않아 멈췄어요. 질문은 화면에서 확인하고 바로 답해 주세요."

/** What leaving would destroy, as a confirmation question; "" when nothing would be lost. Nothing is stored on a server,
 *  so answers of an unfinished interview and recordings (kept only in this tab) are lost on leaving. On the result
 *  screen only the recordings are asked about: the answers are there to read, the recordings are files to save. */
export function leaveWarning({ answers, recordings, finished }: { answers: number; recordings: number; finished: boolean }): string {
  if (finished) return recordings ? `녹화한 답변 영상 ${recordings}개는 이 브라우저에만 있어요. 저장하지 않고 이 화면을 벗어나면 사라져요. 계속할까요?` : ""
  if (!answers && !recordings) return ""
  const what = [answers && `답변 ${answers}개`, recordings && `영상 ${recordings}개`].filter(Boolean).join(", ")
  return `진행 중인 면접 기록(${what})은 저장되지 않아 이 화면을 벗어나면 사라져요. 계속할까요?`
}

/** True when a click on this link leaves the page for another page of this site. Such a client-side navigation never
 *  fires beforeunload, so the interview asks itself. Downloads, new tabs or windows, other sites (beforeunload covers
 *  them) and links to this same page are left alone. */
export function isInSiteLeave(link: { href: string; target?: string | null; download?: boolean }, click: { button: number; modified: boolean }, here: string): boolean {
  if (click.button !== 0 || click.modified || link.download || (link.target && link.target !== "_self")) return false
  let to: URL, from: URL
  try { to = new URL(link.href, here); from = new URL(here) } catch { return false }
  return to.origin === from.origin && (to.pathname !== from.pathname || to.search !== from.search)
}

/** Message for a failed interview API call, by HTTP status, connectivity and the budget check's code. */
export function apiFailureMessage(step: "questions" | "feedback" | "report", status: number | null, online: boolean, code?: unknown): string {
  const [what, obj] = step === "questions" ? ["질문", "질문을"] : step === "feedback" ? ["피드백", "피드백을"] : ["리포트", "리포트를"]
  // Only custom (prep) questions can fail this way; the general interview starts with basic questions instead.
  const next = step === "questions" ? "일반 모의면접은 기본 질문으로 진행할 수 있어요." : "답변 기록은 결과 화면에서 볼 수 있어요."
  switch (aiFailureKind(status, code, online)) {
    case "offline": return `인터넷 연결이 끊겨 ${obj} 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.`
    case "paused": return `지금은 AI 기능이 중지되어 있어 AI ${obj} 받을 수 없어요. ${next}`
    case "quota": return `오늘 AI 사용 한도에 도달해 AI ${obj} 받을 수 없어요. ${next}`
    case "rate": return `요청이 많아 ${what} 생성이 잠시 막혔어요. 1분 뒤 다시 시도해 주세요.`
    case "unavailable": return `지금은 AI 사용량을 확인할 수 없어 ${obj} 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.`
    default: return `AI ${what} 생성에 실패했어요. 다시 시도해 주세요.`
  }
}
