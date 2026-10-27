import type { SupabaseClient } from "@supabase/supabase-js"

// Title (hook) checks before an analysis is saved. The analysis prompt shows example hooks for tone; from 2026-06-27
// (the day after they were added, a7c70f3) to 10-12, 119 published insights used the first example word for word or
// nearly ("검색은 죽지 않았다/죽었다. 검색창이 사라졌을 뿐"). A copied or already-used hook is a failed analysis, so the
// article goes back to pending and is analysed again later instead of publishing a second article under the same title.

/** Distinctive parts of the example hooks in the analysis prompt, compared without spaces or punctuation. */
const PROMPT_EXAMPLE_FRAGMENTS = ["검색창이사라졌을뿐", "그자리를차지할건누구"]

const squash = (s: string) => s.replace(/[\s.,!?'"“”‘’·…~\-—]/g, "").toLowerCase()

export function copiesPromptExample(hook: string): boolean {
  const h = squash(hook)
  return PROMPT_EXAMPLE_FRAGMENTS.some(f => h.includes(f))
}

/** True when another article's insight already has exactly this hook (re-analysing an article may keep its own).
 *  A lookup error is not a duplicate (the save goes on). */
export async function hookTaken(db: SupabaseClient, hook: string, articleId: string): Promise<boolean> {
  const { data, error } = await db.from("insights").select("id").eq("hook", hook.trim()).neq("article_id", articleId).limit(1)
  return !error && (data?.length ?? 0) > 0
}

/** Throws the reason when the hook must not be saved; the callers count it as a failed analysis. */
export async function assertUsableHook(db: SupabaseClient, hook: string, articleId: string): Promise<void> {
  if (copiesPromptExample(hook)) throw new Error("제목 품질 오류: 분석 프롬프트의 예시 제목을 그대로 씀")
  if (await hookTaken(db, hook, articleId)) throw new Error("제목 중복: 다른 기사에 같은 제목의 인사이트가 이미 있음")
}
