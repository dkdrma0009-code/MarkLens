import AdKitStudio from "./AdKitStudio"

export const dynamic = "force-dynamic"

export default function AdKitPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">광고 패키징</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 광고 영상용 매거진 오버레이·엔드카드 PNG 생성 — CapCut에 레이어로 얹으면 끝
        </p>
      </div>
      <AdKitStudio />
    </div>
  )
}
