// MarkLens Design Intelligence V1 — automatic page audit (local review tool, not part of the site build).
// Drives an installed Chrome over the DevTools protocol (no dependencies), measures each page at each width,
// saves a first-screen and a full-page screenshot, and prints 🔴 / 🟡 / 🟢 flags.
//
//   node tools/design-audit.mjs --out .design-audit [--widths 1440,390] [--no-shots] name=https://url ...
//
// Measurements are heuristics that point a reviewer at something; they do not judge design quality.
// The judgement calls (editorial feel, hierarchy, crop quality, brand difference) live in
// docs/design-intelligence/vision-review.md. Thresholds and their reasons: docs/design-intelligence/audit-rules.md.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : fallback }
const out = path.resolve(opt('--out', '.design-audit'))
const widths = opt('--widths', '1440,390').split(',').map(Number)
const chromePath = opt('--chrome', process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const port = Number(opt('--port', '9350'))
const shots = !args.includes('--no-shots'); if (!shots) args.splice(args.indexOf('--no-shots'), 1)
const pages = args.map(a => { const i = a.indexOf('='); return i > 0 && !a.startsWith('http') ? { name: a.slice(0, i), url: a.slice(i + 1) } : { name: new URL(a).hostname, url: a } })
if (!pages.length) { console.error('usage: node tools/design-audit.mjs [--out dir] [--widths 1440,390] name=url ...'); process.exit(1) }
mkdirSync(out, { recursive: true })

// Thresholds (V1). Each one is a prompt to look, not a verdict. Calibrated on 18 reference sites (docs/design-intelligence/audit-rules.md).
const T = {
  minFont: 11, metaFont: 12, // flag text under 11px (9 of 18 references have none, 6 have 5+); 11–12px is reported, not flagged
  repeatMax: 1, cropLoss: 20, // same photo twice on a page; cover-crop that cuts 20%+ of a photo
  blankDesktop: 240, blankMobile: 180, // empty vertical band; reference median 160 / 175px
  screensDesktop: 10, screensMobile: 14, // page length; about the reference article median (9.2 / 13.1 screens)
  foldTexts: 40, foldNumbers: 5, foldLabels: 20, // first screen; references peak at 5 standalone numbers
  cards: 12,
}

const profile = path.join(out, '.chrome-profile')
const chrome = spawn(chromePath, ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu',
  '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let target
for (let i = 0; i < 60 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page') } catch { await sleep(250) } }
if (!target) { console.error(`Chrome did not start (${chromePath}). Set CHROME_PATH or --chrome.`); chrome.kill(); process.exit(1) }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r))
let seq = 0; const pending = new Map(), errors = [], imageRequests = []
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception')
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error')
  if (m.method === 'Network.requestWillBeSent' && m.params.type === 'Image') imageRequests.push(m.params.request.url)
})
const send = (method, params = {}) => new Promise(r => { const n = ++seq; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')

// Runs inside the page. Kept self-contained so it can be pasted into DevTools for a one-off check.
const MEASURE = `(() => {
  const vw = innerWidth, vh = innerHeight, H = document.documentElement.scrollHeight
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 }
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
  // Classified by the first font in the stack (what the designer asked for); custom names fall back to the stack's generic family.
  const family = f => {
    const stack = f.split(',').map(s => s.replace(/["']/g, '').trim().toLowerCase()), first = stack[0], generic = stack.findLast(s => /^(serif|sans-serif|monospace|system-ui)$/.test(s))
    if (/mono|courier|consolas|menlo|code|typewriter/.test(first)) return 'mono'
    if (/sans|grotesk|gothic|pretendard|gmarket|inter|helvetica|arial/.test(first)) return 'sans'
    if (/serif|georgia|times|tiempos|garamond|caslon|playfair|canela|lyon|freight|publico|domaine|myeongjo|batang|chronicle|mercury|plantin|austin|portrait|gt super|reckless/.test(first)) return 'serif'
    return generic === 'serif' ? 'serif' : generic === 'monospace' ? 'mono' : 'sans'
  }
  const texts = [...document.querySelectorAll('body *')].filter(el => ownText(el) && visible(el) && !el.closest('script,style,noscript,svg'))
  const chars = { sans: 0, serif: 0, mono: 0 }; let tiny = [], hangulMono = [], upper = 0, meta = 0
  for (const el of texts) {
    const s = getComputedStyle(el), t = ownText(el), size = parseFloat(s.fontSize), fam = family(s.fontFamily)
    chars[fam] += t.length
    if (size < ${T.minFont}) tiny.push({ size, text: t.slice(0, 30) })
    else if (size < ${T.metaFont}) meta++
    if (fam === 'mono' && /[\\uAC00-\\uD7A3]/.test(t)) hangulMono.push(t.slice(0, 30))
    if ((s.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]{3}/.test(t))) && t.length <= 32) upper++
  }
  const h1 = document.querySelector('h1'), body = [...document.querySelectorAll('p')].find(p => visible(p) && p.textContent.trim().length > 60)
  // Images: repetition by underlying source (CDN wrappers unwrapped, size params ignored).
  const key = src => { try { const u = new URL(src, location.href); const inner = u.searchParams.get('url'); return decodeURIComponent((inner ? inner.replace(/^https?:\\/\\//, '') : u.host + u.pathname).split('?')[0]).normalize('NFC') } catch { return src } }
  const imgs = [...document.images].filter(i => i.currentSrc || i.getAttribute('src'))
  const seen = {}; for (const i of imgs) { if (!visible(i) || i.closest('header,footer,nav') || i.naturalWidth && i.naturalWidth < 64) continue; const k = key(i.currentSrc || i.src); (seen[k] ||= []).push(Math.round(i.getBoundingClientRect().top + scrollY)) }
  const repeated = Object.entries(seen).filter(([, ys]) => ys.length > ${T.repeatMax}).map(([k, ys]) => ({ image: k.slice(-60), count: ys.length, at: ys }))
  // Crop loss: share of the photo cut away by object-fit: cover (text inside photos is often what gets cut).
  const cropped = imgs.filter(i => visible(i) && i.naturalWidth && i.getBoundingClientRect().width >= 120 && getComputedStyle(i).objectFit === 'cover').map(i => {
    const r = i.getBoundingClientRect(), a = i.naturalWidth / i.naturalHeight, b = r.width / r.height
    return { image: key(i.currentSrc || i.src).slice(-40), lost: Math.round((1 - Math.min(a, b) / Math.max(a, b)) * 100), shown: Math.round(r.width) + 'x' + Math.round(r.height) }
  }).filter(c => c.lost >= 15).sort((x, y) => y.lost - x.lost)
  const broken = imgs.filter(i => i.complete && i.naturalWidth === 0 && visible(i)).length
  const missingAlt = imgs.filter(i => !i.hasAttribute('alt')).length
  // Vertical coverage → blank bands (gaps with no visible text, image, svg or video).
  const blocks = [...document.querySelectorAll('img,svg,video,picture,canvas,iframe'), ...texts].filter(visible).map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY] }).sort((a, b) => a[0] - b[0])
  const gaps = []; let end = 0; for (const [a, b] of blocks) { if (a - end > 0 && end > 0) gaps.push({ at: Math.round(end), size: Math.round(a - end) }); end = Math.max(end, b) }
  gaps.sort((a, b) => b.size - a.size)
  // First screen: how much interface it carries.
  const inFold = el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh && !el.closest('header > nav, [role=banner] nav') }
  const foldTexts = texts.filter(inFold)
  const fold = { texts: foldTexts.length, numbers: foldTexts.filter(el => /^[\\d.,:%/\\s-]{1,12}$/.test(ownText(el)) && /\\d/.test(ownText(el))).length,
    labels: foldTexts.filter(el => { const t = ownText(el); return t.length <= 24 && (getComputedStyle(el).textTransform === 'uppercase' || family(getComputedStyle(el).fontFamily) === 'mono') }).length,
    controls: [...document.querySelectorAll('a,button')].filter(el => visible(el) && inFold(el) && !el.closest('header')).length,
    imageShare: Math.min(100, Math.round([...document.querySelectorAll('img,video,picture')].filter(visible).reduce((sum, el) => { const r = el.getBoundingClientRect(); const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)), w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)); return sum + w * h }, 0) / (vw * vh) * 100)) }
  // Decoration: rounded cards, gradients, glass.
  const all = [...document.querySelectorAll('body *')].filter(visible)
  const cards = all.filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return parseFloat(s.borderRadius) >= 12 && r.width > 120 && r.height > 80 && (s.boxShadow !== 'none' || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.borderStyle !== 'none')) }).length
  const gradients = all.filter(el => /gradient/.test(getComputedStyle(el).backgroundImage) && el.getBoundingClientRect().width > 100).length
  const glass = all.filter(el => getComputedStyle(el).backdropFilter !== 'none' && getComputedStyle(el).backdropFilter !== '').length
  // Dark / light rhythm: background luminance sampled down the page centre.
  const lum = c => { const m = c.match(/\\d+(\\.\\d+)?/g); if (!m) return 1; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
  const bgAt = el => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c } return 'rgb(255,255,255)' }
  const tones = []; for (let y = 0; y < H; y += 400) { scrollTo({ top: Math.max(0, y - vh / 2), behavior: 'instant' }); const el = document.elementFromPoint(vw / 2, Math.min(vh - 1, y - scrollY)); if (el) tones.push(lum(bgAt(el)) < 0.35 ? 'D' : 'L') }
  scrollTo({ top: 0, behavior: 'instant' })
  const rhythm = tones.join('').replace(/(.)\\1+/g, '$1')
  // "As of" style dates shown to the reader. Only checks that they agree visually; whether they are factually right is Content QA.
  const dateRe = /(20\\d\\d)[.\\-/년 ]+\\s*(\\d{1,2})[.\\-/월 ]+\\s*(\\d{1,2})/
  const stamps = texts.filter(el => /updated|업데이트|기준|as of|snapshot|last update/i.test(el.parentElement?.textContent ?? '') && dateRe.test(el.parentElement?.textContent ?? '') && (el.parentElement?.textContent ?? '').length < 80)
    .map(el => { const t = el.parentElement.textContent.replace(/\\s+/g, ' ').trim(), m = t.match(dateRe); return { label: t.slice(0, 50), date: m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') } })
  const dateStamps = [...new Map(stamps.map(s => [s.label, s])).values()]
  return { title: document.title, height: H, screens: +(H / vh).toFixed(1), overflow: document.documentElement.scrollWidth > vw + 1,
    h1: h1 ? { size: Math.round(parseFloat(getComputedStyle(h1).fontSize)), family: family(getComputedStyle(h1).fontFamily), text: h1.textContent.trim().slice(0, 50) } : null,
    bodyFamily: body ? family(getComputedStyle(body).fontFamily) : null, bodySize: body ? parseFloat(getComputedStyle(body).fontSize) : null,
    charShare: Object.fromEntries(Object.entries(chars).map(([k, v]) => [k, Math.round(v / Math.max(1, chars.sans + chars.serif + chars.mono) * 100)])),
    tinyText: tiny.length, metaText: meta, tinySamples: tiny.sort((a, b) => a.size - b.size).slice(0, 4), hangulMono: hangulMono.length, hangulMonoSamples: hangulMono.slice(0, 4), upperLabels: upper,
    images: imgs.length, broken, missingAlt, repeated, cropped: cropped.slice(0, 8), largestBlanks: gaps.slice(0, 3), fold, cards, gradients, glass, rhythm, dateStamps }
})()`

const report = []
for (const page of pages) for (const width of widths) {
  errors.length = 0; imageRequests.length = 0
  const mobile = width < 768, height = mobile ? 844 : 900
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  try { await send('Page.navigate', { url: page.url }) } catch {}
  for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState === "complete"')) break }
  await sleep(1500)
  await evaluate('(async () => { for (let y = 0; y < Math.min(document.body.scrollHeight, 30000); y += 500) { scrollTo({ top: y, behavior: "instant" }); await new Promise(r => setTimeout(r, 90)) } scrollTo({ top: 0, behavior: "instant" }) })()')
  await evaluate('Promise.race([Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.addEventListener("load", r); i.addEventListener("error", r) }))), new Promise(r => setTimeout(r, 10000))])')
  await sleep(1200)
  const m = await evaluate(MEASURE)
  if (!m) { console.log(`${page.name}@${width}  (page did not load)`); continue }
  const result = { name: page.name, url: page.url, width, ...m, nextImage: imageRequests.filter(u => u.includes('/_next/image')).length, consoleErrors: errors.length }
  // Flags: 🔴 must fix, 🟡 look at it. Anything else is 🟢.
  const flags = []
  const red = (w, why) => flags.push(['🔴', w, why]), amber = (w, why) => flags.push(['🟡', w, why])
  if (result.broken) red('broken images', `${result.broken}`)
  if (result.overflow) red('horizontal overflow', 'page wider than screen')
  if (result.nextImage) red('/_next/image requests', `${result.nextImage} (Vercel image optimizer in use)`)
  if (result.consoleErrors) red('console errors', `${result.consoleErrors}`)
  if (result.hangulMono) amber('Korean in mono font', result.hangulMonoSamples.join(' · '))
  if (result.tinyText) amber(`text under ${T.minFont}px`, `${result.tinyText} elements, e.g. ${result.tinySamples.map(s => s.size + 'px "' + s.text + '"').slice(0, 2).join(', ')} (plus ${result.metaText} at ${T.minFont}–${T.metaFont}px)`)
  if (result.repeated.length) amber(`image used more than ${T.repeatMax}×`, result.repeated.map(r => `${r.count}× …${r.image.slice(-28)} (y=${r.at.join(', ')})`).join(', '))
  if (result.missingAlt) amber('images without alt', `${result.missingAlt}`)
  const heavyCrops = result.cropped.filter(c => c.lost >= T.cropLoss)
  if (heavyCrops.length) amber(`photos cropped ${T.cropLoss}%+`, heavyCrops.map(c => `${c.lost}% of …${c.image.slice(-24)} (${c.shown})`).slice(0, 3).join(', '))
  if (new Set(result.dateStamps.map(d => d.date)).size > 1) amber('as-of dates disagree', result.dateStamps.map(d => `"${d.label}"`).join(' vs '))
  const blankLimit = mobile ? T.blankMobile : T.blankDesktop
  const blanks = result.largestBlanks.filter(g => g.size > blankLimit); if (blanks.length) amber('large blank bands', blanks.map(g => `${g.size}px at y=${g.at}`).join(', '))
  if (result.screens > (mobile ? T.screensMobile : T.screensDesktop)) amber('long page', `${result.screens} screens (${result.height}px)`)
  if (result.fold.texts > T.foldTexts || result.fold.numbers > T.foldNumbers || result.fold.labels > T.foldLabels) amber('busy first screen', `${result.fold.texts} text blocks, ${result.fold.numbers} numbers, ${result.fold.labels} small labels`)
  if (result.cards > T.cards) amber('many rounded cards', `${result.cards}`)
  if (result.glass || result.gradients > 3) amber('glass / gradient decoration', `${result.glass} glass, ${result.gradients} gradients`)
  result.flags = flags.map(([level, what, detail]) => ({ level, what, detail }))
  report.push(result)
  const file = `${page.name}-${width}`
  writeFileSync(path.join(out, `${file}.json`), JSON.stringify(result, null, 1))
  if (shots) {
    const fold = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } })
    if (fold.result) writeFileSync(path.join(out, `${file}-fold.png`), Buffer.from(fold.result.data, 'base64'))
    const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(result.height, 9000), scale: 1 } })
    if (full.result) writeFileSync(path.join(out, `${file}-full.png`), Buffer.from(full.result.data, 'base64'))
  }
  console.log(`\n${page.name} @${width}  h1 ${result.h1?.size ?? '-'}px ${result.h1?.family ?? ''}  type ${JSON.stringify(result.charShare)}  rhythm ${result.rhythm}  fold img ${result.fold.imageShare}%`)
  console.log(result.flags.length ? result.flags.map(f => `  ${f.level} ${f.what}: ${f.detail}`).join('\n') : '  🟢 no automatic flags')
}
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1))
ws.close(); chrome.kill(); await sleep(400); try { rmSync(profile, { recursive: true, force: true }) } catch {}
