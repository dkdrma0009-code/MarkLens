import type { Slide } from "./types"
import WordmarkSvg from "@/lib/brand/WordmarkSvg"
import { categoryLabel, editorialLines, ROLE_LABELS, slideCopy, type EditorialContext } from "./editorial"

const W = 1080, H = 1350
const INK = "#101010", WHITE = "#FAFAF7", BLUE = "#164BFF"

function textLines(text: string, size: number, width: number, max: number, bold = false) {
  return <div style={{ display: "flex", flexDirection: "column", fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.2, letterSpacing: bold ? "-0.035em" : "-0.01em" }}>
    {editorialLines(text, width, max).map((line, i) => <div key={i} style={{ display: "flex" }}>{line}</div>)}
  </div>
}

function photograph(image: NonNullable<EditorialContext["image"]>, boxHeight: number, crop = false) {
  // Explicit contain geometry preserves the complete face/logo/product without
  // depending on Satori's unsupported object-fit: contain.
  const scale = Math.min(W / image.width, boxHeight / image.height)
  const width = image.width * scale, height = image.height * scale
  return <div style={{ display: "flex", width: W, height: boxHeight, overflow: "hidden", alignItems: "center", justifyContent: "center", background: INK }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- Satori requires a native image */}
    <img alt="Article editorial visual" src={image.dataUri} width={crop ? W : width} height={crop ? boxHeight : height} style={crop ? { objectFit: "cover" } : {}} />
  </div>
}

export function renderEditorialSlide(slide: Slide, category: string, total: number, page: number, ctx: EditorialContext): React.ReactElement {
  const role = slide.role ?? "what"
  const { headline, body } = slideCopy(slide)
  const source = slide.type === "fact" ? slide.source || ctx.source : ctx.source
  const hook = role === "hook", end = role === "end", action = role === "action"
  const photo = ctx.family === "photo" && !!ctx.image && (hook || role === "why")
  const data = ctx.family === "data" && !!ctx.metric && (hook || ((role === "context" || role === "what") && body.replace(/\s+/g, " ").trim() === ctx.metric.statement))
  const dark = photo || action || end || (hook && ctx.family === "typography") || (role === "context" && !data) || (role === "why" && ctx.family !== "photo")
  const color = dark ? WHITE : INK
  const metricSize = (ctx.metric?.value.length ?? 0) <= 5 ? 164 : (ctx.metric?.value.length ?? 0) <= 9 ? 104 : 80
  const footer = <div style={{ display: "flex", position: "absolute", bottom: 48, left: 64, right: 64, justifyContent: "space-between", fontSize: 25, letterSpacing: "0.06em", color: dark ? "#AAA" : "#646464" }}>
    <WordmarkSvg reverse={dark} width={145} />{!hook ? <span>{String(page).padStart(2, "0")}/{String(total).padStart(2, "0")}</span> : null}
  </div>
  return <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: dark ? INK : WHITE, color, fontFamily: "Pretendard" }}>
    {photo && ctx.image ? photograph(ctx.image, hook ? 910 : 760, ctx.photoCrop) : null}
    <div style={{ display: "flex", flexDirection: "column", padding: photo ? "30px 64px 0" : "64px", flexGrow: 1 }}>
      <div style={{ display: "flex", fontSize: 27, fontWeight: 600, letterSpacing: "0.08em", color: BLUE, marginBottom: photo ? 20 : 38 }}>
        {hook ? categoryLabel(category) : ROLE_LABELS[role]}
      </div>
      {data && ctx.metric ? <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, paddingBottom: 90 }}>
        {textLines(ctx.metric.value, metricSize, 952 / metricSize, 1, true)}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>{textLines(hook ? headline : ctx.metric.statement, 54, 16, 4, true)}</div>
        {!hook ? <div style={{ display: "flex", flexDirection: "column", marginTop: 44, color: "#626262" }}>{textLines(`${ctx.metric.source} · ${ctx.metric.date}`, 27, 31, 2)}</div> : null}
      </div> : action ? <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, gap: 44, paddingBottom: 84 }}>
        {body.split(/\n/).filter(s => s.trim()).slice(0, 3).map((item, i) => <div key={i} style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
          <span style={{ display: "flex", fontSize: 37, color: BLUE, fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
          {textLines(item.replace(/^\s*\d+[.)]\s*/, ""), 54, 15, 3, true)}
        </div>)}
        {page === total ? <div style={{ display: "flex", fontSize: 27, color: "#AAA", marginTop: 30 }}>전체 맥락은 marklens.site</div> : null}
      </div> : <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: photo ? "flex-start" : "center", paddingBottom: photo ? 76 : 110 }}>
        {textLines(headline || (role === "what" ? "무슨 일이 일어났나" : ""), hook ? (photo ? 70 : 94) : (end ? 76 : 70), hook ? (photo ? 13.5 : 10) : 13, hook ? (photo ? 3 : 4) : (photo ? 2 : 3), true)}
        {!hook && body ? <div style={{ display: "flex", flexDirection: "column", marginTop: 36, color: dark ? "#D4D4D4" : "#454545" }}>{textLines(body, photo ? 38 : 43, photo ? 24 : 22, photo ? 4 : 5)}</div> : null}
        {role === "what" && source ? <div style={{ display: "flex", flexDirection: "column", marginTop: 44, color: dark ? "#AAA" : "#666" }}>{textLines(`${source}${ctx.date ? ` · ${ctx.date}` : ""}`, 27, 31, 2)}</div> : null}
        {end ? <div style={{ display: "flex", fontSize: 27, color: "#AAA", marginTop: 44 }}>marklens.site</div> : null}
      </div>}
    </div>
    {footer}
  </div>
}
