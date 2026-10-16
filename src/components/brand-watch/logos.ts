// Brand Watch hero wordmarks: unmodified copies of each brand's own dark-background logo (checked 2026-10-16).
// A brand appears here only when its first-party site uses a version that reads on a dark ground; MarkLens never
// recolours, redraws or crops a logo. Brands without such a version keep the text heading.
// OLIVE YOUNG: every first-party version (oliveyoung.co.kr, corp.oliveyoung.com) is black. Toss: toss.im only uses
// the blue symbol with dark lettering. Both keep the text heading.
export interface BrandLogo { src: string; width: number; height: number; displayHeight: number; source: string }

export const BRAND_LOGOS: Record<string, BrandLogo> = {
  // White Korean wordmark from the baemin.com header (_next/static/media/logo@2x.50e61b82.png).
  baemin: { src: "/brand-watch/logos/baemin-wordmark-white.png", width: 284, height: 64, displayHeight: 72, source: "https://www.baemin.com/" },
  // White wordmark from the musinsa.com store's dark header (image.msscdn.net/display/images/2025/10/22/d9647c20….png).
  musinsa: { src: "/brand-watch/logos/musinsa-wordmark-white.png", width: 243, height: 60, displayHeight: 64, source: "https://www.musinsa.com/" },
  // Orange symbol + wordmark rendered inline in the about.daangn.com header (markup copied verbatim, page class/style removed).
  danggeun: { src: "/brand-watch/logos/danggeun-logo.svg", width: 203, height: 114, displayHeight: 104, source: "https://about.daangn.com/" },
}
