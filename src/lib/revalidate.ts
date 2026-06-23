import { revalidatePath } from "next/cache"

// 공개 콘텐츠(인사이트) 변경 시 ISR로 캐시된 공개 페이지를 즉시 무효화한다.
// 공개 페이지(홈·목록·상세)는 revalidate=3600 캐시라, 발행/편집/삭제가 1시간 늦게 반영되는
// 것을 막기 위해 변경 직후 이 함수를 호출해 다음 방문 시 새로 렌더하도록 한다.
export function revalidatePublicContent() {
  revalidatePath("/")                       // 홈 (최신 인사이트 목록)
  revalidatePath("/insights")               // 인사이트 목록
  revalidatePath("/insights/[slug]", "page") // 모든 상세 페이지
}
