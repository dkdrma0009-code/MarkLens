import posters from "./stock-posters.json"

// 카테고리별 스톡 포스터(큐레이션 카드뉴스의 그리드·폴백 이미지).
// JSON에는 버킷 안 경로만 두고, 주소는 이 배포가 연결된 Supabase 프로젝트로 만든다: Production은 기존과 같은 주소,
// Preview는 Preview 프로젝트의 같은 버킷을 읽어 Preview 렌더가 운영 Storage(Egress)를 쓰지 않는다(R-4).
export const STOCK_POSTER_BUCKET = "stock-posters"
const PATHS = posters as Record<string, string[]>

/** 공개 객체 주소. 프로젝트 주소가 없으면 null(포스터 없이 렌더). */
export function stockPosterUrl(path: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string | null {
  const project = base.replace("﻿", "").trim().replace(/\/+$/, "")
  return project ? `${project}/storage/v1/object/public/${STOCK_POSTER_BUCKET}/${path}` : null
}

/** 카테고리 슬러그의 포스터 주소 목록(없으면 default). */
export function stockPosterPool(slug: string, base?: string): string[] {
  return (PATHS[slug] ?? PATHS["default"] ?? []).map((p) => stockPosterUrl(p, base)).filter((u): u is string => !!u)
}
