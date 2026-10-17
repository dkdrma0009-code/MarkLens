# MarkLens Design Bible V1

**Built from:**
- the brand system as it exists in code and docs:
  - `docs/brand/A2.md`
  - `public/brand/`
  - the tokens in `src/app/(public)/public.css`
  - the Brand Watch editorial rules
- the reference research in [patterns.md](patterns.md)

**Not built from:** taste or a single reference.

**Superseded source:** `DESIGN_PROMPT.md` (the older homepage prompt) asks for "Linear meets Notion / premium SaaS", forbids
blue and recommends rounded cards and pill badges. The site no longer follows it, and this Bible replaces it as the design
reference. The file is left untouched; deleting it is a separate decision.

**Positioning:** Premium Editorial Marketing Intelligence Media. "Marketing × Trend × Intelligence". "Where Marketing Trends Become Action".

**Value order on every page:** Editorial Authority → Signal → Frame.
- **Authority:** what is known, with a source.
- **Signal:** what repeats.
- **Frame:** what it means and what to do with it.

---

## FIXED — do not change without a brand decision

| # | Rule | Where it lives | Why |
|---|---|---|---|
| F1 | **Wordmark** is the canonical A2 SVG: primary on light, reverse on dark, at least 120px wide, no signal period in the header. Never font-rendered. | `public/brand/`, `docs/brand/A2.md` | Approved 2026-10-10 |
| F2 | **Palette:** ink `#111114`, dark `#101113`, paper `#fff`, soft `#fafafa`, line `#dedee2`, muted `#686970`. **One accent:** Electric Blue `#164BFF`. No second accent color. | `--ml-*` tokens | 13 of 18 references use one accent or none in their UI (patterns P4) |
| F3 | **Blue is a signal, not a fill.** Use it for the headline period, links, the primary CTA and the "MarkLens Take" marker. It is never a section background or a gradient. | public.css, brands.css | Keeps blue meaning "this is MarkLens' read" |
| F4 | **Square corners and hairlines.** Radius 0 (public CSS has one `border-radius`, set to 0). Structure comes from 1px rules and spacing, not shadows or boxes. | public.css | Editorial grid, not app cards (P9) |
| F5 | **Type roles:** Korean display is a heavy sans with tight tracking (Gmarket Sans / Pretendard 800). Body is Pretendard. Mono (Geist Mono) is for **Latin and numerals only**: dates, counts, eyebrows. **Hangul never in mono.** | layout.tsx fonts | Geist Mono has no Hangul, so Korean falls back and spaces out (baseline 🟡 #1) |
| F6 | **Fact and interpretation stay visibly separate.** FACT and source sit next to the claim. MarkLens' interpretation lives in its own marked area (the dark Take section). | BrandDossier | It is the product's trust model, not a style |
| F7 | **Brand Watch imagery is first-party only.** Use official newsroom or brand assets, with a visible credit. No generative, stock or media-hosted images. Covered brands' logos are used as supplied, never recolored. | `launch/visuals.ts`, logos.ts | Rights and trust (media-rights chapter) |
| F8 | **Images go through the CDN srcset, never `/_next/image`.** | `CdnImage`, `next.config.ts` | Vercel usage (fix/vercel-usage-optimization) |
| F9 | **Asymmetric editorial heroes:** copy on one side, a strong image on the other, one dominant element. | Home, dossier hero | Brand language: asymmetric composition |
| F10 | **Motion is controlled and optional.** Short reveals only. `prefers-reduced-motion` is honored everywhere. No scroll-jacking, parallax stacks or autoplay video. | motion.css, composition.css | Brand language: controlled cinematic motion |
| F11 | **No ranking or scoring of brands.** Brand Watch says "순위를 매기지 않습니다". No scores, grades, progress rings or leaderboards. | BrandIndex copy | Editorial stance |

## FLEXIBLE — may be tested, one change at a time, with before/after captures

| # | Area | Current state | What may change |
|---|---|---|---|
| X1 | **Section rhythm** | The three largest dossier gaps are all 158–200px (desktop). Home switches dark and light 9 times. | Vary spacing by section role; fewer, longer dark passages (P10) |
| X2 | **Pattern section scale** | **Settled (B′, `abc1371`):** a text-led reveal. The supporting moves are a reference list with 120px / 80px thumbnails; one bracket leads to the statement (up to 72px, compact over 32 characters). The one-dominant-image variant was rejected because it repeats photos already shown large. | Change only through the change policy |
| X3 | **Metadata density** | FACT labels raised from 10px to 11px. Still 22–36 uppercase micro-labels per dossier; the footer is 10px. | Fewer labels, 12px floor, labels only where they carry information (P6) |
| X4 | **Home hero voice** | Latin "FOR THE NEXT GENERATION." | Korean-first or signal-led headline. Needs a copy decision, not only design. |
| X5 | **Crop rules** | `cover` except registered `contain` visuals; the DANGGEUN posters and the OLIVE YOUNG City Log logo image were moved to `contain` after an eye check | Use `contain`, or a wider frame, for images with printed type or logos. Check by eye; the crop share alone decides nothing. |
| X6 | **Mobile length** | Brand dossiers are 8.7–9.4k px at 390 | Collapse the source list and timeline, and shorten repeated captions |
| X7 | **Serif for long reading** | No serif anywhere | Only as an experiment on Insight body text, never in Brand Watch data areas (P5, HOLD) |
| X8 | **Number display** | MOVES / PATTERNS counts in index rows | Keep as text meta, or drop. Never as tiles. |

## FORBIDDEN / HIGH RISK

| # | Do not | Why |
|---|---|---|
| N1 | Gradients, glass (`backdrop-filter`), glow, neon UI. Colorful photos are fine; the UI chrome is not. | Generic AI and SaaS look; conflicts with F2/F3 |
| N2 | Rounded cards with shadows, pill badges, icon-plus-three-features rows | SaaS landing-page grammar (P9) |
| N3 | KPI tiles, stat strips in heroes, progress bars, sparkle "AI" icons, "AI가 분석한" wording | AI-dashboard feel; conflicts with F11 |
| N4 | Hangul in a mono font. Any text under 11px. | Readability; baseline findings |
| N5 | Re-using the hero photo as a large image elsewhere on the same page | Reads as a shortage of material (baseline 🟡 image repetition) |
| N6 | Cropping printed text inside official images | It misquotes the source visually |
| N7 | Countdown timers, "only N left", pop-up newsletter walls before content | Trust cost. Seen on Longblack, Highsnobiety, Dezeen and Semafor; not for MarkLens. |
| N8 | Copying one reference's signature move, such as The Verge's rotated wordmark or The Pudding's hand-drawn titles | Identity loss; violates research method |
| N9 | Generative or stock imagery anywhere in Brand Watch | F7 |
| N10 | A second accent color, or recoloring partner logos | F2, F7 |

## How to use this

Before a design change, name the rule it touches. Use the IDs: F means stop and ask, X means test with captures,
N means don't. Then run `tools/design-audit.mjs` and [vision-review.md](vision-review.md) before and after.

**Frozen as V1 (2026-10-17).** The FIXED / FLEXIBLE / FORBIDDEN lists were re-checked after Pattern B′ and still hold.
A new reference alone does not change this file. A change needs all three of:
- repeated evidence across independent sites
- fit with the FIXED rules
- the owner's approval

See the change policy in [README.md](README.md#change-policy).
