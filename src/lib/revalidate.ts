import { revalidatePath } from "next/cache"

// 공개 콘텐츠(인사이트) 변경 시 ISR로 캐시된 공개 페이지를 즉시 무효화한다.
// 공개 페이지(홈·목록·상세)는 revalidate=3600 캐시라, 발행/편집/삭제가 1시간 늦게 반영되는
// 것을 막기 위해 변경 직후 이 함수를 호출해 다음 방문 시 새로 렌더하도록 한다.
//
// 상세 페이지는 실제로 바뀐 slug만 무효화한다. 상세 route 패턴 전체("/insights/[slug]", "page")를
// 무효화하면 글 1건만 바뀌어도 발행된 상세 전체(~1,000개)가 재생성 대상이 되어 ISR Writes가 폭증한다.
// slug를 넘기지 않으면 홈·목록만 무효화한다. (slug는 slugify()로 만든 ASCII라 경로에 그대로 쓴다)
export function revalidatePublicContent({ slugs = [] }: { slugs?: (string | null | undefined)[] } = {}) {
  revalidatePath("/")                       // 홈 (최신 인사이트 목록)
  revalidatePath("/insights")               // 인사이트 목록
  for (const slug of new Set(slugs.filter((s): s is string => !!s))) {
    revalidatePath(`/insights/${slug}`)     // 바뀐 상세 페이지만
  }
}
