"use client"

import type { IgInsights, IgMediaInsight } from "@/lib/instagram"
import type { ThreadsInsights, ThreadsMediaInsight } from "@/lib/threads"

// 주간 콘텐츠 템플릿 (0=일 1=월 2=화 3=수 4=목 5=금 6=토)
const DAY_PLAN: Record<number, { label: string; platform: string; color: string }> = {
  1: { label: "인사이트 카드", platform: "인스타+스레드", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900" },
  2: { label: "용어카드",      platform: "인스타",       color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-900" },
  3: { label: "케이스스터디", platform: "인스타+스레드", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900" },
  4: { label: "스레드 텍스트", platform: "스레드",       color: "text-gray-600 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700" },
  5: { label: "릴스/숏츠",    platform: "인스타",       color: "text-pink-600 bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-900" },
  6: { label: "뉴스레터 알림",platform: "인스타+스레드", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900" },
  0: { label: "휴식",          platform: "—",            color: "text-gray-400 bg-transparent border-transparent" },
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"]

// ISO timestamp → KST 날짜 문자열 (YYYY-MM-DD)
function toKSTDate(ts: string): string {
  const d = new Date(ts)
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

type PostEntry =
  | { type: "ig"; data: IgMediaInsight }
  | { type: "threads"; data: ThreadsMediaInsight }

interface CalendarViewProps {
  igData: IgInsights | null
  threadsData: ThreadsInsights | null
}

export default function CalendarView({ igData, threadsData }: CalendarViewProps) {
  // 날짜별 게시물 맵 (KST 기준)
  const postsByDate = new Map<string, PostEntry[]>()
  for (const m of igData?.media ?? []) {
    const date = toKSTDate(m.timestamp)
    if (!postsByDate.has(date)) postsByDate.set(date, [])
    postsByDate.get(date)!.push({ type: "ig", data: m })
  }
  for (const m of threadsData?.media ?? []) {
    const date = toKSTDate(m.timestamp)
    if (!postsByDate.has(date)) postsByDate.set(date, [])
    postsByDate.get(date)!.push({ type: "threads", data: m })
  }

  // 브라우저 현재 시각 기준 — 한국 사용자이므로 로컬타임 = KST
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  // 이번 주 월요일 계산 (일요일=0 → -6, 나머지 → 1-dow)
  const dow = today.getDay()
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow))

  // 3주 생성: 지난주(-7) / 이번주(0) / 다음주(+7)
  const weeks: { label: string; days: Date[] }[] = [-1, 0, 1].map((offset, i) => {
    const days: Date[] = Array.from({ length: 7 }, (_, d) => {
      const dt = new Date(thisMonday)
      dt.setDate(thisMonday.getDate() + offset * 7 + d)
      return dt
    })
    return { label: ["지난주", "이번주", "다음주"][i], days }
  })

  function dateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  return (
    <div className="space-y-8">
      {/* 주간 템플릿 참고표 */}
      <div className="border border-border rounded-lg p-5 bg-background">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">주간 콘텐츠 템플릿</p>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map(d => {
            const plan = DAY_PLAN[d]
            return (
              <div key={d} className={`rounded-lg border p-2.5 text-center ${plan.color}`}>
                <p className="text-xs font-bold mb-1">{DAYS_KO[d]}</p>
                <p className="text-[10px] font-semibold leading-tight">{plan.label}</p>
                <p className="text-[9px] opacity-60 mt-0.5">{plan.platform}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 계정 요약 */}
      <div className="grid grid-cols-2 gap-4">
        {igData ? (
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold">
                인스타그램 <span className="font-normal text-muted-foreground">@{igData.account.username}</span>
              </p>
              <a href={`https://instagram.com/${igData.account.username}`} target="_blank" rel="noopener"
                className="text-[10px] text-muted-foreground hover:text-foreground">열기 →</a>
            </div>
            <div className="flex gap-6">
              <div><p className="text-2xl font-semibold tabular-nums">{igData.account.followers.toLocaleString()}</p><p className="text-[11px] text-muted-foreground mt-0.5">팔로워</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{igData.account.mediaCount}</p><p className="text-[11px] text-muted-foreground mt-0.5">게시물</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{igData.dailyReach.reduce((s, d) => s + d.reach, 0).toLocaleString()}</p><p className="text-[11px] text-muted-foreground mt-0.5">최근 도달</p></div>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">인스타그램 미연동</p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-1">IG_ACCESS_TOKEN · IG_USER_ID 확인 필요</p>
          </div>
        )}
        {threadsData ? (
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold">
                스레드 <span className="font-normal text-muted-foreground">@{threadsData.account.username}</span>
              </p>
              <a href={`https://threads.net/@${threadsData.account.username}`} target="_blank" rel="noopener"
                className="text-[10px] text-muted-foreground hover:text-foreground">열기 →</a>
            </div>
            <div className="flex gap-6">
              <div><p className="text-2xl font-semibold tabular-nums">{threadsData.account.followers.toLocaleString()}</p><p className="text-[11px] text-muted-foreground mt-0.5">팔로워</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{threadsData.totalViews.toLocaleString()}</p><p className="text-[11px] text-muted-foreground mt-0.5">총 조회</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{threadsData.media.length}</p><p className="text-[11px] text-muted-foreground mt-0.5">최근 게시물</p></div>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">스레드 미연동</p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-1">THREADS_ACCESS_TOKEN · THREADS_USER_ID 확인 필요</p>
          </div>
        )}
      </div>

      {/* 3주 캘린더 */}
      <div className="space-y-6">
        {weeks.map((week) => (
          <div key={week.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{week.label}</p>
            <div className="grid grid-cols-7 gap-2">
              {week.days.map((date, di) => {
                const ds = dateStr(date)
                const dayOfWeek = date.getDay()
                const plan = DAY_PLAN[dayOfWeek]
                const posts = postsByDate.get(ds) ?? []
                const isToday = ds === todayStr
                const isPast = ds < todayStr
                const isRestDay = dayOfWeek === 0

                return (
                  <div key={di}
                    className={`rounded-xl border p-2.5 min-h-[130px] flex flex-col transition-colors
                      ${isToday
                        ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20"
                        : "border-border bg-background"
                      }
                      ${isRestDay ? "opacity-50" : ""}`}
                  >
                    {/* 날짜 헤더 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[11px] font-semibold ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                        {DAYS_KO[dayOfWeek]}
                      </span>
                      <span className={`text-[11px] tabular-nums font-medium
                        ${isToday ? "bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : "text-muted-foreground"}`}>
                        {date.getDate()}
                      </span>
                    </div>

                    {/* 계획 레이블 */}
                    {!isRestDay && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full mb-2 self-start font-semibold border ${plan.color}
                        ${posts.length === 0 && isPast ? "opacity-30" : ""}`}>
                        {plan.label}
                      </span>
                    )}

                    {/* 게시물 */}
                    <div className="flex-1 flex flex-col gap-1">
                      {posts.map((p, pi) => (
                        <PostCard key={pi} entry={p} />
                      ))}
                      {posts.length === 0 && !isPast && !isRestDay && (
                        <div className="flex-1 border border-dashed border-border/50 rounded-lg flex items-center justify-center">
                          <span className="text-[9px] text-muted-foreground/40">미게시</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 최근 게시물 전체 목록 */}
      {(igData?.media.length || threadsData?.media.length) ? (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">최근 게시물 인사이트</h2>
          </div>
          <div className="divide-y divide-border">
            {/* 인스타 */}
            {igData?.media.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-pink-500 bg-pink-50 dark:bg-pink-950/40 px-1.5 py-0.5 rounded">IG</span>
                </div>
                <div className="flex-1 min-w-0">
                  <a href={m.permalink} target="_blank" rel="noopener"
                    className="text-sm font-medium line-clamp-1 hover:underline">
                    {m.caption || "(캡션 없음)"}
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{m.timestamp.slice(0, 10)} · {m.mediaType}</p>
                </div>
                <div className="flex gap-4 flex-shrink-0 text-xs tabular-nums">
                  <div className="text-center"><p className="font-semibold">{m.reach.toLocaleString()}</p><p className="text-muted-foreground text-[10px]">도달</p></div>
                  <div className="text-center"><p className="font-semibold">{m.likes}</p><p className="text-muted-foreground text-[10px]">좋아요</p></div>
                  <div className="text-center"><p className="font-semibold">{m.saved}</p><p className="text-muted-foreground text-[10px]">저장</p></div>
                  <div className="text-center"><p className="font-semibold">{m.shares}</p><p className="text-muted-foreground text-[10px]">공유</p></div>
                  <div className="text-center"><p className="font-semibold">{m.comments}</p><p className="text-muted-foreground text-[10px]">댓글</p></div>
                </div>
              </div>
            ))}
            {/* 스레드 */}
            {threadsData?.media.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">TH</span>
                </div>
                <div className="flex-1 min-w-0">
                  <a href={m.permalink} target="_blank" rel="noopener"
                    className="text-sm font-medium line-clamp-1 hover:underline">
                    {m.text || "(내용 없음)"}
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{m.timestamp.slice(0, 10)}</p>
                </div>
                <div className="flex gap-4 flex-shrink-0 text-xs tabular-nums">
                  <div className="text-center"><p className="font-semibold">{m.views.toLocaleString()}</p><p className="text-muted-foreground text-[10px]">조회</p></div>
                  <div className="text-center"><p className="font-semibold">{m.likes}</p><p className="text-muted-foreground text-[10px]">좋아요</p></div>
                  <div className="text-center"><p className="font-semibold">{m.replies}</p><p className="text-muted-foreground text-[10px]">답글</p></div>
                  <div className="text-center"><p className="font-semibold">{m.reposts}</p><p className="text-muted-foreground text-[10px]">리포스트</p></div>
                  <div className="text-center"><p className="font-semibold">{m.quotes}</p><p className="text-muted-foreground text-[10px]">인용</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PostCard({ entry }: { entry: PostEntry }) {
  if (entry.type === "ig") {
    const m = entry.data
    return (
      <a href={m.permalink} target="_blank" rel="noopener"
        className="block border border-pink-100 dark:border-pink-900/40 bg-pink-50/50 dark:bg-pink-950/20 rounded-lg p-1.5 hover:border-pink-300 transition-colors">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[8px] font-bold text-pink-500 uppercase shrink-0">IG</span>
          <span className="text-[9px] text-foreground/70 truncate">{m.caption || "(캡션 없음)"}</span>
        </div>
        <div className="flex gap-2 text-[9px] text-muted-foreground">
          <span>👁 {m.reach}</span>
          <span>♥ {m.likes}</span>
          <span>🔖 {m.saved}</span>
        </div>
      </a>
    )
  }
  const m = entry.data
  return (
    <a href={m.permalink} target="_blank" rel="noopener"
      className="block border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-1.5 hover:border-gray-400 transition-colors">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[8px] font-bold text-gray-500 uppercase shrink-0">TH</span>
        <span className="text-[9px] text-foreground/70 truncate">{m.text || "(내용 없음)"}</span>
      </div>
      <div className="flex gap-2 text-[9px] text-muted-foreground">
        <span>👁 {m.views}</span>
        <span>♥ {m.likes}</span>
        <span>↩ {m.replies}</span>
      </div>
    </a>
  )
}
