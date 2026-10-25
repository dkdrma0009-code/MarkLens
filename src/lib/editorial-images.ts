// 운영자가 승인해 기사 대표 이미지(articles.image_url)로 쓰는 MarkLens 편집 이미지의 대체 텍스트와 출처.
// 수집 기사 이미지는 내용을 알 수 없어 장식(alt="")으로 두고, 여기 등록한 이미지만 내용을 설명하고 출처를 밝힌다.
// CC 라이선스 사진은 작가·원본·라이선스·수정 사실을 캡션으로 표시해야 한다(ArticleVisual).
export type EditorialImageInfo = {
  alt: string
  credit?: { author: string; sourceUrl: string; sourceName: string; license: string; licenseUrl: string; changes: string }
}

const IMAGES: Record<string, EditorialImageInfo> = {
  "https://marklens.site/editorial/chatgpt-ads-89-countries-photo.jpg": {
    alt: "100달러 지폐 더미 위에 놓인 스마트폰. 검은 화면에 흰 글씨로 ChatGPT가 크게 떠 있는 흑백 사진.",
    credit: {
      author: "Jernej Furman",
      sourceUrl: "https://www.flickr.com/photos/91261194@N06/52916923766/",
      sourceName: "Flickr",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
      changes: "흑백 보정·크롭",
    },
  },
  // 이전 대표 이미지(MarkLens 자체 그래픽) — 되돌릴 때를 위해 남겨 둔다.
  "https://marklens.site/editorial/chatgpt-ads-89-countries-hero.jpg": {
    alt: "AI 답변을 상징하는 문서 패널과, 빛의 경계선 바깥에 따로 놓인 AD 광고 슬롯을 그린 그래픽.",
  },
}

export function editorialImage(url?: string | null): EditorialImageInfo | null {
  return url ? IMAGES[url] ?? null : null
}
