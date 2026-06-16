import { getInstagramInsights } from "@/lib/instagram"
import { getThreadsInsights } from "@/lib/threads"
import CalendarView from "./CalendarView"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const [igData, threadsData] = await Promise.all([
    getInstagramInsights(),
    getThreadsInsights(),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">콘텐츠 캘린더</h1>
        <p className="text-sm text-muted-foreground mt-1">주간 계획 · 인스타그램 · 스레드</p>
      </div>
      <CalendarView igData={igData} threadsData={threadsData} />
    </div>
  )
}
