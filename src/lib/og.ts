// The site-wide Open Graph image (src/app/opengraph-image.tsx). A page that defines its own `openGraph` replaces the
// parent's object (Next merges metadata shallowly), so such a page must list this image itself or it ships none.
export const SITE_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "MarkLens — Where Marketing Trends Become Action" }
