import { PDFDocument, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const A4 = { w: 595.28, h: 841.89 }, MARGIN = 56
const ACCENT = rgb(0.39, 0.4, 0.95), DARK = rgb(0.05, 0.05, 0.05), GRAY = rgb(0.42, 0.42, 0.42)
function wrap(text, font, size, maxW) { const lines = []; let cur = ""; for (const ch of text) { if (font.widthOfTextAtSize(cur + ch, size) > maxW && cur) { lines.push(cur); cur = ch } else cur += ch } if (cur) lines.push(cur); return lines }

const bold = await readFile(join(process.cwd(), "assets/fonts/Pretendard-Bold.otf"))
const reg = await readFile(join(process.cwd(), "assets/fonts/Pretendard-Regular.otf"))
const pdf = await PDFDocument.create()
pdf.registerFontkit(fontkit)
const fb = await pdf.embedFont(bold) // subset 미사용 (OTF CFF 서브셋 미지원)
const fr = await pdf.embedFont(reg)

let page = pdf.addPage([A4.w, A4.h]); let y = A4.h - MARGIN
page.drawText("MARKLENS", { x: MARGIN, y, size: 12, font: fb, color: GRAY }); y -= 110
page.drawText("마케팅 면접", { x: MARGIN, y, size: 40, font: fb, color: DARK }); y -= 50
page.drawText("질문 44선", { x: MARGIN, y, size: 40, font: fb, color: DARK }); y -= 60
page.drawText("취준생·주니어 마케터를 위한 실전 면접 질문 모음", { x: MARGIN, y, size: 14, font: fr, color: GRAY }); y -= 60
const sample = ["왜 마케팅이고, 왜 우리 회사인가요?", "ROAS와 CAC를 설명하고, 둘 중 무엇을 더 중요하게 보겠어요?", "전환율이 갑자기 떨어졌습니다. 어떤 순서로 원인을 찾겠어요? 데이터·채널·소재를 어떻게 나눠서 점검할지 구체적으로 말해보세요."]
page.drawRectangle({ x: MARGIN, y: y - 2, width: 4, height: 18, color: ACCENT })
page.drawText("샘플 섹션", { x: MARGIN + 14, y, size: 17, font: fb, color: DARK }); y -= 34
let n = 0
for (const q of sample) { n++; const num = String(n).padStart(2, "0") + "."; const numW = fr.widthOfTextAtSize(num + "  ", 11.5); const lines = wrap(q, fr, 11.5, A4.w - MARGIN * 2 - numW); page.drawText(num, { x: MARGIN, y, size: 11.5, font: fb, color: ACCENT }); lines.forEach((ln, i) => page.drawText(ln, { x: MARGIN + numW, y: y - i * 18, size: 11.5, font: fr, color: rgb(0.15, 0.15, 0.15) })); y -= lines.length * 18 + 10 }
await writeFile("._test.pdf", await pdf.save())
console.log("PDF 생성 완료")
