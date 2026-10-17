// MarkLens Design Intelligence V1.1 — automatic page audit (local review tool, not part of the site build).
// Drives an installed Chrome over the DevTools protocol (no dependencies), measures each page at each width,
// saves a first-screen and a full-page screenshot, and reports PASS / REVIEW / FAIL.
//
//   node tools/design-audit.mjs --out .design-audit [--widths 1440,390] [--no-shots] name=https://url ...
//
// FAIL is reserved for things that are objectively broken (broken image, overflow, console error, /_next/image,
// double image proxy, image without a source). Everything visual or editorial is REVIEW: a pointer for a person or
// the vision review (docs/design-intelligence/vision-review.md), never a verdict.
// Thresholds and their reasons: docs/design-intelligence/audit-rules.md.
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

// Thresholds (V1.1). Calibrated on 18 reference sites (docs/design-intelligence/audit-rules.md).
const T = {
  minFont: 11, metaFont: 12, // under 11px: REVIEW (9 of 18 references have none); 11px is the minimum exception; 12px+ recommended
  primaryChars: 40, // own text this long counts as primary content, shorter is metadata
  cropLoss: 20, cropLarge: 35, cropExtreme: 45, // cover-crop share; REVIEW only with a reason (large, poster-like, or text in the image)
  thumbWidth: 160, // below this a photo is a reference thumbnail: its crop share alone is INFO, a risk signal makes it REVIEW
  repeatWidth: 200, // a repeated photo is REVIEW only when 2+ uses are at least this wide; smaller reuse is a reference
  blankDesktop: 240, blankMobile: 180, // empty vertical band; reference median 160 / 175px
  screensDesktop: 9.2, screensMobile: 13.1, // reference article medians; longer is reported, not judged
  tailScreens: 2, // REVIEW a long page only if its last image is followed by more than this many screens of text
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
  const top = el => Math.round(el.getBoundingClientRect().top + scrollY)
  const sectionOf = el => { const s = el.closest('section') || el.closest('header, footer, aside, article'); return s ?(s.id || (typeof s.className === 'string' && s.className.trim().split(/\\s+/)[0]) || s.tagName.toLowerCase()) : 'page' }
  // Classified by the first font in the stack (what the designer asked for); custom names fall back to the stack's generic family.
  const family = f => {
    const stack = f.split(',').map(s => s.replace(/["']/g, '').trim().toLowerCase()), first = stack[0], generic = stack.findLast(s => /^(serif|sans-serif|monospace|system-ui)$/.test(s))
    if (/mono|courier|consolas|menlo|code|typewriter/.test(first)) return 'mono'
    if (/sans|grotesk|gothic|pretendard|gmarket|inter|helvetica|arial/.test(first)) return 'sans'
    if (/serif|georgia|times|tiempos|garamond|caslon|playfair|canela|lyon|freight|publico|domaine|myeongjo|batang|chronicle|mercury|plantin|austin|portrait|gt super|reckless/.test(first)) return 'serif'
    return generic === 'serif' ? 'serif' : generic === 'monospace' ? 'mono' : 'sans'
  }
  const texts = [...document.querySelectorAll('body *')].filter(el => ownText(el) && visible(el) && !el.closest('script,style,noscript,svg'))
  const chars = { sans: 0, serif: 0, mono: 0 }, small = { metadata: [], primary: [] }, minimum = { metadata: 0, primary: 0 }
  let hangulMono = [], upper = 0
  for (const el of texts) {
    const s = getComputedStyle(el), t = ownText(el), size = parseFloat(s.fontSize), fam = family(s.fontFamily), role = t.length >= ${T.primaryChars} ? 'primary' : 'metadata'
    chars[fam] += t.length
    if (size < ${T.minFont}) small[role].push({ size, text: t.slice(0, 30) })
    else if (size < ${T.metaFont}) minimum[role]++
    if (fam === 'mono' && /[\\uAC00-\\uD7A3]/.test(t)) hangulMono.push(t.slice(0, 30))
    if ((s.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]{3}/.test(t))) && t.length <= 32) upper++
  }
  const fonts = Object.fromEntries(['metadata', 'primary'].map(k => [k, { under11: small[k].length, at11: minimum[k], samples: small[k].sort((a, b) => a.size - b.size).slice(0, 3) }]))
  const h1 = document.querySelector('h1'), body = [...document.querySelectorAll('p')].find(p => visible(p) && p.textContent.trim().length > 60)
  // Images. Repetition is keyed by the underlying source (CDN wrapper and size parameters ignored).
  const key = src => { try { const u = new URL(src, location.href); const inner = u.searchParams.get('url'); return decodeURIComponent((inner ? inner.replace(/^https?:\\/\\//, '') : u.host + u.pathname).split('?')[0]).normalize('NFC') } catch { return src } }
  const imgs = [...document.images]
  const noSource = imgs.filter(i => visible(i) && !i.getAttribute('src') && !i.getAttribute('srcset')).length
  // Site chrome (a header or footer outside the content) is skipped; a hero header inside the content is counted.
  const chrome = el => el.closest('nav') || [el.closest('header'), el.closest('footer')].some(c => c && !c.closest('main, article'))
  const seen = {}; for (const i of imgs) { if (!(i.currentSrc || i.src) || !visible(i) || chrome(i) || i.naturalWidth && i.naturalWidth < 64) continue; const r = i.getBoundingClientRect(); (seen[key(i.currentSrc || i.src)] ||= []).push({ y: top(i), width: Math.round(r.width), section: sectionOf(i) }) }
  const repeated = Object.entries(seen).filter(([, uses]) => uses.length > 1).map(([k, uses]) => ({ image: k.slice(-60), count: uses.length, uses, large: uses.filter(u => u.width >= ${T.repeatWidth}).length }))
  // Crop: share of the photo cut away by object-fit: cover, with the reasons it might matter. Whether letters,
  // faces, products or logos are actually cut is a vision-review question.
  const textHint = /[‘’“”"'「」]|문구|포스터|글자|텍스트|타이포|키 ?비주얼|poster|banner|배너|text|key visual|headline/i
  const subjectHint = /얼굴|인물|사람|초상|portrait|face|제품|상품|product|로고|logo/i
  // A reference thumbnail (under thumbWidth) is not reviewed for crop share alone: its printed text is unreadable either
  // way. It still is when it looks like a poster or document, is cut to the extreme, or is cut hard where its alt
  // describes text, a face, a product or a logo.
  const cropped = imgs.filter(i => visible(i) && i.naturalWidth && i.getBoundingClientRect().width >= 64 && getComputedStyle(i).objectFit === 'cover').map(i => {
    const r = i.getBoundingClientRect(), a = i.naturalWidth / i.naturalHeight, b = r.width / r.height, lost = Math.round((1 - Math.min(a, b) / Math.max(a, b)) * 100)
    const small = r.width < ${T.thumbWidth}, hint = textHint.test(i.alt) ? 'alt suggests text in image' : subjectHint.test(i.alt) ? 'alt names a face, product or logo' : null
    const reasons = small
      ? [lost >= ${T.cropExtreme} && 'extreme crop', a <= 0.9 && 'portrait / poster shape', hint && lost >= ${T.cropLarge} && hint].filter(Boolean)
      : [lost >= ${T.cropLarge} && 'large crop', a <= 0.9 && 'portrait / poster shape', hint].filter(Boolean)
    return { image: key(i.currentSrc || i.src).slice(-40), lost, small, reasons, shown: Math.round(r.width) + 'x' + Math.round(r.height), y: top(i), section: sectionOf(i) }
  }).filter(c => c.lost >= ${T.cropLoss}).sort((x, y) => y.lost - x.lost)
  const broken = imgs.filter(i => i.complete && (i.currentSrc || i.getAttribute('src')) && i.naturalWidth === 0 && visible(i)).length
  const missingAlt = imgs.filter(i => !i.hasAttribute('alt')).length
  // Vertical coverage → blank bands (gaps with no visible text, image, svg or video).
  const blocks = [...document.querySelectorAll('img,svg,video,picture,canvas,iframe'), ...texts].filter(visible).map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY] }).sort((a, b) => a[0] - b[0])
  const gaps = []; let end = 0; for (const [a, b] of blocks) { if (a - end > 0 && end > 0) gaps.push({ at: Math.round(end), size: Math.round(a - end) }); end = Math.max(end, b) }
  gaps.sort((a, b) => b.size - a.size)
  // Length context: sections, and how much text-only page follows the last real image before the footer.
  const footer = document.querySelector('footer'), contentEnd = footer && visible(footer) ? top(footer) : H
  const media = [...document.querySelectorAll('img,video,picture,canvas')].filter(el => visible(el) && el.getBoundingClientRect().width >= 120 && !el.closest('header,footer,nav'))
  const lastMedia = media.reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom + scrollY), 0)
  const length = { sections: [...document.querySelectorAll('main section, main h2')].filter(visible).filter(el => el.tagName === 'SECTION' || !el.closest('main section')).length,
    textTail: Math.max(0, Math.round(contentEnd - lastMedia)), textTailScreens: +(Math.max(0, contentEnd - lastMedia) / vh).toFixed(1) }
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
  // Dates shown next to "Updated / 기준 / as of" labels. Different dates may mean different things; Content QA decides.
  const dateRe = /(20\\d\\d)[.\\-/년 ]+\\s*(\\d{1,2})[.\\-/월 ]+\\s*(\\d{1,2})/
  const stamps = texts.filter(el => /updated|업데이트|기준|as of|snapshot|last update/i.test(el.parentElement?.textContent ?? '') && dateRe.test(el.parentElement?.textContent ?? '') && (el.parentElement?.textContent ?? '').length < 80)
    .map(el => { const t = el.parentElement.textContent.replace(/\\s+/g, ' ').trim(), m = t.match(dateRe); return { label: t.slice(0, 50), date: m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'), section: sectionOf(el) } })
  const dateStamps = [...new Map(stamps.map(s => [s.label, s])).values()]
  return { title: document.title, height: H, screens: +(H / vh).toFixed(1), overflow: document.documentElement.scrollWidth > vw + 1,
    h1: h1 ? { size: Math.round(parseFloat(getComputedStyle(h1).fontSize)), family: family(getComputedStyle(h1).fontFamily), text: h1.textContent.trim().slice(0, 50) } : null,
    bodyFamily: body ? family(getComputedStyle(body).fontFamily) : null, bodySize: body ? parseFloat(getComputedStyle(body).fontSize) : null,
    charShare: Object.fromEntries(Object.entries(chars).map(([k, v]) => [k, Math.round(v / Math.max(1, chars.sans + chars.serif + chars.mono) * 100)])),
    fonts, hangulMono: hangulMono.length, hangulMonoSamples: hangulMono.slice(0, 4), upperLabels: upper,
    images: imgs.length, broken, noSource, missingAlt, repeated, cropped: cropped.slice(0, 8), largestBlanks: gaps.slice(0, 3), length, fold, cards, gradients, glass, rhythm, dateStamps }
})()`

// Stable rule ids (used by tools/quality-review.mjs and docs/quality-review/). FAIL checks are functional, REVIEW checks are design.
const RULE_IDS = [
  [/^broken images/, 'FUNC-IMAGE-003'], [/^images without a source/, 'FUNC-IMAGE-004'], [/^horizontal overflow/, 'FUNC-LAYOUT-001'],
  [/^console errors/, 'FUNC-PAGE-001'], [/^\/_next\/image/, 'FUNC-IMAGE-001'], [/^double image proxy/, 'FUNC-IMAGE-002'],
  [/^Korean in mono/, 'DESIGN-TEXT-002'], [/text under/, 'DESIGN-TEXT-001'], [/^same photo/, 'DESIGN-IMAGE-001'], [/^crop to check/, 'DESIGN-IMAGE-002'],
  [/^DATE REVIEW/, 'DESIGN-DATE-001'], [/^images without alt/, 'DESIGN-A11Y-001'], [/^large blank/, 'DESIGN-SPACE-001'], [/^long page/, 'DESIGN-LENGTH-001'],
  [/^busy first screen/, 'DESIGN-HERO-001'], [/rounded cards|glass/, 'DESIGN-STYLE-001'],
]
const ruleId = what => RULE_IDS.find(([pattern]) => pattern.test(what))?.[1] ?? 'DESIGN-OTHER'

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
  const result = { name: page.name, url: page.url, width, ...m, consoleErrors: errors.length,
    nextImage: imageRequests.filter(u => u.includes('/_next/image')).length, doubleProxy: imageRequests.filter(u => (u.match(/images\.weserv\.nl/g) ?? []).length > 1).length }
  const checks = []
  const fail = (what, detail) => checks.push({ level: 'FAIL', id: ruleId(what), what, detail }), review = (what, detail) => checks.push({ level: 'REVIEW', id: ruleId(what), what, detail })
  // FAIL: objectively broken.
  if (result.broken) fail('broken images', `${result.broken}`)
  if (result.noSource) fail('images without a source', `${result.noSource}`)
  if (result.overflow) fail('horizontal overflow', 'page wider than screen')
  if (result.consoleErrors) fail('console errors', `${result.consoleErrors}`)
  if (result.nextImage) fail('/_next/image requests', `${result.nextImage} (Vercel image optimizer in use)`)
  if (result.doubleProxy) fail('double image proxy', `${result.doubleProxy} requests wrap the CDN in itself`)
  // REVIEW: look at it; the decision belongs to a person or the vision review.
  if (result.hangulMono) review('Korean in mono font', result.hangulMonoSamples.join(' · '))
  for (const role of ['metadata', 'primary']) { const f = result.fonts[role]; if (f.under11) review(`${role} text under ${T.minFont}px`, `${f.under11}, e.g. ${f.samples.map(s => `${s.size}px "${s.text}"`).join(', ')}`) }
  const repeatReview = result.repeated.filter(r => r.large > 1)
  if (repeatReview.length) review('same photo used large more than once', repeatReview.map(r => `${r.count}× …${r.image.slice(-24)} (${r.uses.map(u => `${u.section} ${u.width}px`).join(' → ')})`).join('; '))
  const cropReview = result.cropped.filter(c => c.reasons.length)
  if (cropReview.length) review('crop to check (text, face, product, logo?)', cropReview.map(c => `${c.lost}% of ${c.small ? 'thumbnail ' : ''}…${c.image.slice(-20)} in ${c.section} (${c.reasons.join(', ')})`).slice(0, 4).join('; '))
  if (new Set(result.dateStamps.map(d => d.date)).size > 1) review('DATE REVIEW', `different dates on screen; Content QA decides what each means: ${result.dateStamps.map(d => `"${d.label}"`).join(' / ')}`)
  if (result.missingAlt) review('images without alt', `${result.missingAlt}`)
  const blankLimit = mobile ? T.blankMobile : T.blankDesktop
  const blanks = result.largestBlanks.filter(g => g.size > blankLimit); if (blanks.length) review('large blank bands', blanks.map(g => `${g.size}px at y=${g.at}`).join(', '))
  const median = mobile ? T.screensMobile : T.screensDesktop
  if (result.screens > median * 2 || (result.screens > median && result.length.textTailScreens > T.tailScreens)) review('long page', `${result.screens} screens vs reference median ${median}; ${result.length.sections} sections; text-only tail ${result.length.textTailScreens} screens`)
  if (result.fold.texts > T.foldTexts || result.fold.numbers > T.foldNumbers || result.fold.labels > T.foldLabels) review('busy first screen', `${result.fold.texts} text blocks, ${result.fold.numbers} numbers, ${result.fold.labels} small labels`)
  if (result.cards > T.cards) review('many rounded cards', `${result.cards}`)
  if (result.glass || result.gradients > 3) review('glass / gradient decoration', `${result.glass} glass, ${result.gradients} gradients`)
  result.checks = checks
  result.result = checks.some(c => c.level === 'FAIL') ? 'FAIL' : checks.length ? 'REVIEW' : 'PASS'
  report.push(result)
  const file = `${page.name}-${width}`
  writeFileSync(path.join(out, `${file}.json`), JSON.stringify(result, null, 1))
  if (shots) {
    const fold = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } })
    if (fold.result) writeFileSync(path.join(out, `${file}-fold.png`), Buffer.from(fold.result.data, 'base64'))
    const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(result.height, 9000), scale: 1 } })
    if (full.result) writeFileSync(path.join(out, `${file}-full.png`), Buffer.from(full.result.data, 'base64'))
  }
  const repeats = result.repeated.reduce((n, r) => n + r.count - 1, 0)
  console.log(`\n${result.result.padEnd(6)} ${page.name} @${width}  ${result.screens} screens (${result.height}px, ${result.length.sections} sections, text tail ${result.length.textTailScreens})  repeats ${repeats}  crops≥${T.cropLoss}% ${result.cropped.length}`)
  for (const c of checks) console.log(`  ${c.level.padEnd(6)} ${c.what}: ${c.detail}`)
}
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1))
ws.close(); chrome.kill(); await sleep(400); try { rmSync(profile, { recursive: true, force: true }) } catch {}
