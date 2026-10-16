import type { CSSProperties } from "react"
import Image from "next/image"
import { weservThumb } from "@/lib/images"
import type { PublicVisual } from "@/lib/brand-watch/public/types"

// Server-rendered visual evidence. The image CDN resizes (no Vercel image transformation) and the source page's
// image is linked, not copied. If it fails to load, CSS replaces the broken image with a plate naming the provider.
// A poster shown whole (fit "contain") gets the same image, enlarged and blurred, as its backdrop. A host that
// refuses the CDN ("direct") is loaded as published rather than routed around.
export function EvidenceImage({ visual, width, eager = false, decorative = false }: { visual: PublicVisual; width: number; eager?: boolean; decorative?: boolean }) {
  const src = visual.delivery === "direct" ? visual.src : weservThumb(visual.src, width)
  return (
    <span className="bw-visual" data-origin={visual.origin} data-fit={visual.fit} data-focus={visual.focus} style={visual.fit === "contain" ? { "--bw-backdrop": `url("${src}")` } as CSSProperties : undefined}>
      <Image src={src} alt={decorative ? "" : visual.alt} fill unoptimized loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} referrerPolicy="no-referrer" data-fallback={visual.provider} />
    </span>
  )
}

// Provenance stays visible: who provided the image and which footnoted source carries it.
export function VisualCredit({ visual }: { visual: PublicVisual }) {
  return (
    <span className="bw-visual-credit">
      <span>이미지</span>
      <a href={`#source-${visual.sourceRef}`} aria-label={`이미지 출처 ${visual.sourceRef}번으로 이동`}>{visual.origin === "media" ? `${visual.credit} 제공 · ${visual.provider}` : visual.provider} [{visual.sourceRef}]</a>
    </span>
  )
}
