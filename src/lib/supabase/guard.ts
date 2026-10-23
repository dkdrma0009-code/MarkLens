import { blockedReason } from "@/lib/release/guard.mjs"

// Preview write guard (R-2). In production and local runs the client is returned as is. In a Preview that cannot prove
// its database is not production, every write (insert/update/upsert/delete, write RPCs, storage changes) resolves to a
// Supabase-shaped error instead of reaching the database — existing `error` handling reports it; reads and auth pass.
const READ_ONLY_RPCS = new Set(["random_quiz"])
const TABLE_WRITES = new Set(["insert", "update", "upsert", "delete"])
const STORAGE_WRITES = new Set(["upload", "update", "remove", "move", "copy", "createSignedUploadUrl", "uploadToSignedUrl"])
const BUCKET_WRITES = new Set(["createBucket", "updateBucket", "deleteBucket", "emptyBucket"])

function blockedResult(reason: string) {
  const result = { data: null, error: { message: reason, code: "PREVIEW_WRITE_BLOCKED", details: null, hint: null }, count: null, status: 403, statusText: "Forbidden" }
  // Any chained call (.select(), .eq(), .single() …) keeps the blocked result; awaiting it yields { data: null, error }.
  const chain: object = new Proxy(function () {}, {
    get: (_target, prop) => prop === "then" ? (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) : () => chain,
    apply: () => chain,
  })
  return chain
}

function wrapMethods<T extends object>(target: T, blocked: Set<string>, reason: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver)
      if (typeof prop === "string" && blocked.has(prop)) return () => blockedResult(reason)
      return typeof value === "function" ? value.bind(obj) : value
    },
  })
}

export function guardWrites<T extends object>(client: T): T {
  const reason = blockedReason("db-write")
  if (!reason) return client
  return new Proxy(client, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver)
      if (prop === "from") return (table: string) => wrapMethods((value as (t: string) => object).call(obj, table), TABLE_WRITES, reason)
      if (prop === "rpc") return (fn: string, ...rest: unknown[]) => READ_ONLY_RPCS.has(fn) ? (value as (...a: unknown[]) => unknown).call(obj, fn, ...rest) : blockedResult(reason)
      if (prop === "storage") {
        const storage = wrapMethods(value as object, BUCKET_WRITES, reason)
        return new Proxy(storage, { get: (s, p, r) => p === "from" ? (bucket: string) => wrapMethods((Reflect.get(s, p, r) as (b: string) => object)(bucket), STORAGE_WRITES, reason) : Reflect.get(s, p, r) })
      }
      return typeof value === "function" ? value.bind(obj) : value
    },
  })
}
