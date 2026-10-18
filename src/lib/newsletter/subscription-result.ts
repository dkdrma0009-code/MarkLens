export function subscriptionResult(data: { success?: boolean; alreadySubscribed?: boolean; emailFailed?: boolean; subscriptionCreated?: boolean }) {
  if (data.success !== true) return "failure"
  if (data.alreadySubscribed) return "already"
  if (data.emailFailed) return "emailFailed"
  return data.subscriptionCreated === true ? "new" : "existing"
}

// What a subscribe form tells the reader, from the HTTP status and body of POST /api/subscribe (status 0: no response).
// Only a request that actually sent the confirmation mail says so; `done` means the form can close.
export type SubscriptionOutcome = { result: ReturnType<typeof subscriptionResult> | "invalid" | "rateLimited"; done: boolean; message: string }
export function subscriptionOutcome(status: number, data: Parameters<typeof subscriptionResult>[0] | null): SubscriptionOutcome {
  if (status === 400) return { result: "invalid", done: false, message: "이메일 주소를 다시 확인해주세요." }
  if (status === 429) return { result: "rateLimited", done: false, message: "요청이 많아요. 1분 뒤 다시 시도해주세요." }
  const result = status >= 200 && status < 300 && data ? subscriptionResult(data) : "failure"
  if (result === "failure") return { result, done: false, message: "구독을 처리하지 못했어요. 잠시 후 다시 시도해주세요." }
  if (result === "already") return { result, done: true, message: "이미 구독 중인 이메일이에요." }
  if (result === "emailFailed") return { result, done: false, message: "확인 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요." }
  return { result, done: true, message: "확인 이메일을 보냈어요. 받은 편지함에서 구독을 확인해주세요." }
}
