import type { CSSProperties, ImgHTMLAttributes } from "react"
import { editorialImageLoader, editorialSrcSet } from "@/lib/images"

// A fill image served entirely by the image CDN: the browser picks a width from srcset/sizes.
// Vercel image optimization is off globally (next.config images.unoptimized), so next/image cannot emit a
// srcset; this renders the same fill <img> next/image did, plus the CDN candidates.
const FILL: CSSProperties = { position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, color: "transparent" }

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "style"> & { src: string; sizes: string; fallbackWidth: number }

export default function CdnImage({ src, sizes, fallbackWidth, alt = "", ...rest }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- CDN srcset; Vercel image optimization is intentionally off
  return <img {...rest} alt={alt} src={editorialImageLoader({ src, width: fallbackWidth })} srcSet={editorialSrcSet(src)} sizes={sizes} decoding="async" style={FILL} />
}
