import { readFileSync, existsSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// P-1 web fonts: Pretendard is served as the official dynamic subset (unicode-range slices, nothing preloaded) and the
// Gmarket Sans heading font is no longer preloaded on every page. These checks keep full Korean coverage and stop the
// 3.8MB "preload every weight everywhere" setup from coming back.
const css = readFileSync('src/app/pretendard.css', 'utf8')
const faces = [...css.matchAll(/@font-face\{font-family:Pretendard;[^}]*font-weight:(\d+);src:url\(([^)]+)\) format\("woff2"\);unicode-range:([^}]+)\}/g)]
  .map(([, weight, url, ranges]) => ({ weight: +weight, url, ranges: ranges.split(',').map(r => r.replace(/^U\+/i, '').split('-').map(x => parseInt(x, 16))) }))

test('pretendard: four weights, 92 official slices each, every file present and self-hosted', () => {
  assert.deepEqual([...new Set(faces.map(f => f.weight))].sort(), [400, 500, 600, 700])
  for (const weight of [400, 500, 600, 700]) assert.equal(faces.filter(f => f.weight === weight).length, 92, `weight ${weight}`)
  for (const { url } of faces) {
    assert.match(url, /^\/fonts\/pretendard-1\.3\.9\/Pretendard-(Regular|Medium|SemiBold|Bold)\.subset\.\d+\.woff2$/)
    assert.ok(existsSync('public' + url), url)
  }
  assert.equal(readdirSync('public/fonts/pretendard-1.3.9').filter(name => name.endsWith('.woff2')).length, 368)
  assert.match(readFileSync('public/fonts/pretendard-1.3.9/LICENSE.txt', 'utf8'), /SIL Open Font License, Version 1\.1/)
  assert.match(css, /font-display:swap/); assert.doesNotMatch(css, /font-display:(block|auto)/)
})

test('pretendard: every Hangul syllable, compatibility jamo and printable ASCII character is covered at every weight', () => {
  for (const weight of [400, 500, 600, 700]) {
    const ranges = faces.filter(f => f.weight === weight).flatMap(f => f.ranges)
    const covered = cp => ranges.some(([a, b = a]) => cp >= a && cp <= b)
    const missing = []
    for (const [from, to] of [[0xac00, 0xd7a3], [0x3131, 0x318e], [0x20, 0x7e]]) for (let cp = from; cp <= to; cp++) if (!covered(cp)) missing.push(cp.toString(16))
    assert.deepEqual(missing, [], `weight ${weight}`)
  }
})

test('layout: Pretendard comes from the subset CSS, Gmarket Sans is not preloaded, the subset is cached immutably', () => {
  const layout = readFileSync('src/app/layout.tsx', 'utf8')
  assert.match(layout, /import "\.\/pretendard\.css"/)
  assert.doesNotMatch(layout, /Pretendard-(Regular|Medium|SemiBold|Bold)\.woff2/)
  assert.match(layout, /className=\{`ml-font-pretendard /)
  assert.match(layout, /GmarketSansBold\.woff2[\s\S]*?preload: false/)
  // The class must outrank Tailwind's :root --font-sans and keep the metric-matched fallback in the stack.
  assert.match(css, /html\.ml-font-pretendard\{--font-sans:"Pretendard","Pretendard Fallback",/)
  assert.match(css, /@font-face\{font-family:"Pretendard Fallback";src:local\(Arial\);[^}]*size-adjust:/)
  assert.match(readFileSync('next.config.ts', 'utf8'), /source: "\/fonts\/pretendard-1\.3\.9\/:file\*", headers: \[\{ key: "Cache-Control", value: "public, max-age=31536000, immutable" \}\]/)
})
