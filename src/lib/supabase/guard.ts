import { blockedReason } from "@/lib/release/guard.mjs"

// Preview database guard (R-2, R-3). In production, local runs and a Preview on a provably isolated database the client
// is returned as is. In a Preview that cannot prove its database is not production, the client touches nothing: tables
// and RPCs resolve to a Supabase-shaped error, storage calls fail, and auth reports no user — so subscriber emails, admin
// data and production sessions are neither read nor written. Existing `error` / `user` handling reports it.
function blockedResult(reason: string) {
  const result = { data: null, error: { message: reason, code: "PREVIEW_DB_BLOCKED", details: null, hint: null }, count: null, status: 403, statusText: "Forbidden" }
  // Any chained call (.select(), .eq(), .single() …) keeps the blocked result; awaiting it yields { data: null, error }.
  const chain: object = new Proxy(function () {}, {
    get: (_target, prop) => prop === "then" ? (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) : () => chain,
    apply: () => chain,
  })
  return chain
}

function blockedAuth(reason: string) {
  const error = { message: reason, code: "PREVIEW_DB_BLOCKED", status: 403 }
  return new Proxy({}, {
    get: (_target, prop) => prop === "getUser" ? async () => ({ data: { user: null }, error })
      : prop === "getSession" ? async () => ({ data: { session: null }, error })
      : prop === "onAuthStateChange" ? () => ({ data: { subscription: { unsubscribe() {} } } })
      : async () => ({ data: { user: null, session: null }, error }),
  })
}

// `reason` defaults to this process's verdict; the browser client passes the one inlined at build time.
export function guardDatabase<T extends object>(client: T, reason: string | null = blockedReason("database")): T {
  if (!reason) return client
  const blocked = () => blockedResult(reason)
  const storage = new Proxy({}, { get: () => () => blocked() })
  return new Proxy(client, {
    get(obj, prop, receiver) {
      if (prop === "from" || prop === "rpc" || prop === "schema" || prop === "channel") return blocked
      if (prop === "storage") return storage
      if (prop === "auth") return blockedAuth(reason)
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === "function" ? value.bind(obj) : value
    },
  })
}
