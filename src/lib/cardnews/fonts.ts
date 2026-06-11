import { readFile } from "node:fs/promises"
import { join } from "node:path"

interface FontDef {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 600 | 700
  style: "normal" | "italic"
}

let cache: FontDef[] | null = null
let adCache: FontDef[] | null = null

// Pretendard 풀셋 OTF (서브셋 사용 금지 — 누락 글자 위험)
export async function loadFonts(): Promise<FontDef[]> {
  if (cache) return cache
  const dir = join(process.cwd(), "assets", "fonts")
  const [regular, semibold, bold] = await Promise.all([
    readFile(join(dir, "Pretendard-Regular.otf")),
    readFile(join(dir, "Pretendard-SemiBold.otf")),
    readFile(join(dir, "Pretendard-Bold.otf")),
  ])
  cache = [
    { name: "Pretendard", data: regular as unknown as ArrayBuffer, weight: 400, style: "normal" },
    { name: "Pretendard", data: semibold as unknown as ArrayBuffer, weight: 600, style: "normal" },
    { name: "Pretendard", data: bold as unknown as ArrayBuffer, weight: 700, style: "normal" },
  ]
  return cache
}

// 광고 패키징용 — Pretendard + 세리프 마스트헤드(Playfair Display)
export async function loadAdFonts(): Promise<FontDef[]> {
  if (adCache) return adCache
  const dir = join(process.cwd(), "assets", "fonts")
  const [base, serifBold, serifItalic] = await Promise.all([
    loadFonts(),
    readFile(join(dir, "PlayfairDisplay-Bold.ttf")),
    readFile(join(dir, "PlayfairDisplay-Italic.ttf")),
  ])
  adCache = [
    ...base,
    { name: "Playfair", data: serifBold as unknown as ArrayBuffer, weight: 700, style: "normal" },
    { name: "Playfair", data: serifItalic as unknown as ArrayBuffer, weight: 500, style: "italic" },
  ]
  return adCache
}
