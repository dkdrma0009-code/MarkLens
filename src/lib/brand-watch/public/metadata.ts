import type { Metadata } from "next"
import type { PublicBrandState } from "./types"

// Descriptions are fixed product copy plus, only when it exists, the reviewed Snapshot headline.
// Nothing strategic is written for brands without a published Snapshot. Indexing follows the profile's
// SEO status; Open Graph images come from the site-wide opengraph-image convention.
export const BRANDS_INDEX_DESCRIPTION = "최근 공개 자료와 마케팅 움직임을 MarkLens가 연결해 읽습니다. 사실(FACT), 반복된 움직임(Observed Pattern), MarkLens의 해석을 구분해 보여줍니다."

export function brandsIndexMetadata(states: readonly PublicBrandState[]): Metadata {
  const title = "Brand Watch — 브랜드는 지금 어떻게 움직이는가 | MarkLens"
  const indexable = states.some(state => state.kind === "available" && state.indexable)
  return {
    title, description: BRANDS_INDEX_DESCRIPTION,
    alternates: { canonical: "/brands" },
    openGraph: { title, description: BRANDS_INDEX_DESCRIPTION, url: "/brands", siteName: "MarkLens", type: "website" },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export function brandMetadata(state: PublicBrandState): Metadata {
  const { brand } = state
  const title = `${brand.nameKo} Brand Watch | MarkLens`
  const base = `최근 공개 자료와 마케팅 움직임을 바탕으로 ${brand.nameKo}의 주요 변화와 반복 패턴을 살펴봅니다.`
  const description = state.kind === "available" && state.snapshot ? `${state.snapshot.headline} — ${base}` : base
  const url = `/brands/${brand.slug}`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "MarkLens", type: "website" },
    ...(state.kind === "available" && state.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}
