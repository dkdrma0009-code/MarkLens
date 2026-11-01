import { AsyncLocalStorage } from "node:async_hooks"

// Created only after session authentication, explicit consent and a durable quota check.
// No request header or webhook secret can create this authorization.
type ManualState = { remaining: number; deadline: number; calls: number }
const scopeKey = Symbol.for("marklens.ai.manual-context")
const shared = globalThis as typeof globalThis & { [scopeKey]?: AsyncLocalStorage<ManualState> }
// Instrumentation and route handlers can contain separate bundled copies of this module.
const scope = shared[scopeKey] ??= new AsyncLocalStorage<ManualState>()

export function authorizeManualRequest(): boolean {
  const current = scope.getStore()
  if (!current) return false
  if (current.remaining <= 0 || Date.now() >= current.deadline) throw new Error("Manual AI request budget exhausted")
  current.remaining--
  current.calls++
  return true
}

export async function runManualAI<T>(work: () => Promise<T>): Promise<{ result: T; calls: number }> {
  const state = { remaining: 1, deadline: Date.now() + 25_000, calls: 0 }
  return scope.run(state, async () => ({ result: await work(), calls: state.calls }))
}
