// The home hero's brand cover (C-2 V3): an AI-generated, art-directed image of a fictional person, not article photography.
// Pre-sized WebP sets in /public/home because Vercel image optimization is off globally (next.config images.unoptimized);
// phones get their own vertical frame, everything wider the 16:9 frame. Only this image is fetched with high priority.
const set = (name: string, widths: number[]) => widths.map(width => `/home/${name}-${width}.webp ${width}w`).join(", ")

export default function HeroCover() {
  return (
    <picture className="ml-hero-cover">
      <source media="(max-width: 600px)" type="image/webp" srcSet={set("hero-v3-mobile", [780, 828, 1170])} sizes="100vw" width={1170} height={2096} />
      <img src="/home/hero-v3-desktop-1440.webp" srcSet={set("hero-v3-desktop", [1024, 1440, 1920])} sizes="100vw" width={1920} height={1072} alt="" fetchPriority="high" decoding="async" />
    </picture>
  )
}
