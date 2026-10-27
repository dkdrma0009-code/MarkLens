// Interview (Career Lab) browser support and failure messages. Every failure tells the user what happened and what to
// do next, instead of leaving a spinner or a disabled button (2026-10-27 quality audit: "화상 면접이 작동하지 않는다").

export type MediaIssue = "insecure" | "unsupported" | "denied" | "no-device" | "in-use" | "unknown"

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
  unsupported: { title: "이 브라우저는 카메라 연결을 지원하지 않아요.", action: "최신 Chrome·Edge·Safari에서 열거나, 기본 면접(타이핑·음성)으로 진행하세요." },
  denied: { title: "카메라 또는 마이크 권한이 꺼져 있어요.", action: "주소창 왼쪽 자물쇠 아이콘 → 카메라·마이크 허용 후 '다시 시도'를 눌러 주세요." },
  "no-device": { title: "연결된 카메라를 찾지 못했어요.", action: "카메라를 연결한 뒤 '다시 시도'를 누르거나, 기본 면접으로 진행하세요." },
  "in-use": { title: "다른 앱이 카메라를 사용 중이에요.", action: "화상회의 등 카메라를 쓰는 앱을 닫고 '다시 시도'를 눌러 주세요." },
  unknown: { title: "카메라를 시작하지 못했어요.", action: "'다시 시도'를 누르거나, 기본 면접(타이핑·음성)으로 진행하세요." },
}

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

/** Message for a failed interview API call, by HTTP status and connectivity. */
export function apiFailureMessage(step: "questions" | "feedback" | "report", status: number | null, online: boolean): string {
  const what = step === "questions" ? "질문" : step === "feedback" ? "피드백" : "리포트"
  if (!online) return `인터넷 연결이 끊겨 ${what}을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.`
  if (status === 429) return `요청이 많아 ${what} 생성이 잠시 막혔어요. 1분 뒤 다시 시도해 주세요.`
  if (status === 503) return `오늘 AI 사용량이 많아 ${what}을 만들 수 없어요. 잠시 뒤 다시 시도해 주세요.`
  return `AI ${what} 생성에 실패했어요. 다시 시도해 주세요.`
}
