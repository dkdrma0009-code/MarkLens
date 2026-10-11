export function subscriptionResult(data: { success?: boolean; alreadySubscribed?: boolean; emailFailed?: boolean; subscriptionCreated?: boolean }) {
  if (data.success !== true) return "failure"
  if (data.alreadySubscribed) return "already"
  if (data.emailFailed) return "emailFailed"
  return data.subscriptionCreated === true ? "new" : "existing"
}
