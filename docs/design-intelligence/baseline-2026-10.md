# MarkLens baseline review (2026-10-17)

**Build:** `release/brand-watch-v1` at `c2e4898`, built and served locally on port 3108. It used QA data and never
touched production:
- **Brand Watch:** the launch fixture for MUSINSA, OLIVE YOUNG and DANGGEUN, and the index.
  BAEMIN and TOSS used the full fixture, because they are private at launch.
- **Home and Insights:** 16 sample insights from a local stand-in database. They reuse 8 official images, so **image
  repetition and crops on Home and the Insights list are partly caused by the sample data.**

Nine page types were captured at 1440 and 390 with `tools/design-audit.mjs`. Every number below comes from that run.

## Technical health

| Check | Result |
|---|---|
| Broken images | 0 on all 18 captures |
| Horizontal overflow | 0 |
| Console errors | 0 |
| `/_next/image` requests | 0 |
| Missing alt | 0 |

## Measured summary

| Page | Height 1440 / 390 | Screens 390 | Text <12px (of which <11px), 1440 | First screen: text / numbers / labels (1440) | Same image twice |
|---|---|---|---|---|---|
| Home | 7,237 / 8,699 | 10.3 | 96 (60) | 56 / 11 / 14 | 4 (sample data) |
| Insights list | 4,374 / 3,342 | 4.0 | 43 (2) | 29 / 0 / 2 | 4 (sample data) |
| Insight detail | 6,251 / 5,604 | 6.6 | 30 (2) | 19 / 0 / 2 | 0 |
| Brand Watch index | 1,683 / 2,196 | 2.6 | 13 (10) | 47 / 8 / 15 | 0 |
| BAEMIN (full fixture) | 5,875 / 6,510 | 7.7 | 57 (10) | 25 / 2 / 8 | 1 |
| MUSINSA | 8,043 / 8,708 | 10.3 | 71 (13) | 25 / 3 / 10 | 3 |
| OLIVE YOUNG | 8,095 / 9,401 | 11.1 | 76 (14) | 27 / 3 / 10 | 4 |
| DANGGEUN | 8,281 / 8,957 | 10.6 | 74 (14) | 25 / 3 / 10 | 4 |
| TOSS (full fixture) | 5,815 / 6,802 | 8.1 | 59 (12) | 27 / 2 / 8 | 2 |

**Reference ranges** (18 sites, [references.md](references.md)) for the same measures:
- **Article pages at 390:** 6.5 to 115 screens, median 13.1. Examples: LongBlack 6.6, Atlantic 8.8, Monocle 10,
  OWID 13.1, Pew 21, Semafor 57.
- **Numbers in the first screen:** 0 on most pages. The highest was 5 (The Verge article).
- **Text under 11px:** 9 of 18 sites have none. 6 have 5 or more: Atlantic, Semafor, BoF and OWID have 5–53; the
  Wallpaper* and Monocle mobile homepages have 120 or more.

## The 13 candidate issues, re-checked

| # | Issue | Verdict | Evidence |
|---|---|---|---|
| 1 | Korean category in mono font | **CONFIRMED** | Hangul is set in Geist Mono, which has no Hangul, so it falls back with wide spacing. Found on 3 page types: Insight detail eyebrow ("브랜딩", "목차"), Home category labels ("브랜딩", "퍼포먼스"), and the Brand dossier Snapshot as-of line ("2026.10.08 **기준**", `.bw-asof`). The last one was not in the mid-review. |
| 2 | Snapshot date vs Updated date | **CONFIRMED (visual)** | On the same page, MUSINSA shows "Updated 2026.10.16" and "2026.10.08 기준". OLIVE YOUNG shows .10.16 vs .10.12; DANGGEUN shows .10.16 vs .09.18. The reader sees two "as of" dates with no explanation. Which date is *correct* is Content QA. |
| 3 | OLIVE YOUNG mobile ~9,400px | **PARTIAL** | Measured 9,401px, 11.1 screens. That is below the reference article median at 390 (13.1 screens; Atlantic 8.8, Monocle 10, OWID 13.1, Pew 21). The length is not the problem by itself. The problem is the last third: timeline and sources in 11–12px text with no image or change of pace. |
| 4 | Private TOSS / BAEMIN rows look empty | **CONFIRMED** | In the launch index these rows show "— —" and "-" in the number columns, no thumbnail, and grey one-line copy. Next to three full rows they read as broken data, not "coming soon". |
| 5 | Home "FOR THE NEXT GENERATION." vs Brand Watch tone | **PARTIAL** | The visual system is shared: dark field, heavy sans, blue period. The difference is voice. Home is a generational slogan in Latin caps; Brand Watch is a Korean observational sentence. This is a copy decision first, a design decision second. |
| 6 | Image repetition | **CONFIRMED** | Every dossier shows a Key Move or hero image again in the Pattern section, at a similar size: BAEMIN 1, TOSS 2, MUSINSA 3, OLIVE YOUNG 4, DANGGEUN 4. DANGGEUN also repeats one at y=3585 and y=7050 (Pattern → Timeline). Home and Insights repeats come from the sample data. |
| 7 | Wrong crop | **CONFIRMED** | At 1440, DANGGEUN's two side Key Move tiles (289×216) crop 25% of official posters with printed type; "당근 광고 MCP" loses its first letters. TOSS's Pattern image loses 38% (719×300). On Home the sample hero crops 43% and cuts the printed Korean headline. Home's crop logic is real; this instance comes from sample data. |
| 8 | Tiny metadata | **CONFIRMED on Home and Insights list, PARTIAL on dossiers** | Home: 60 elements under 11px at 1440, down to 9px ("IN FOCUS", "ON THE RADAR"; `.ml-eyebrow` set to 9px in dark sections). At 390 it is 58 elements, down to **8px** ("THE MAIN STORY"). Insights list at 390: 46 elements under 11px (10px category labels). Dossiers at 1440: 10–14 under 11px (10px "FACT" chips) plus 47–62 at 11–12px; at 390 only the footer. The site footer is 10px on every page. Desktop dossier text is *smaller* than mobile. |
| 9 | Excessive hero info | **CONFIRMED on Home and Index; fixed on dossiers** | Dossier heroes were simplified in 7.6: 25 text blocks, 2–3 numbers. Home's first screen has 56 text blocks, 11 numbers and 14 labels (radar list, pager "03 / 03", pulse strip). Index: 47 / 8 / 15, including a legend of three label chips. |
| 10 | Uniform section spacing | **PARTIAL** | The three largest gaps on every dossier sit in a narrow band: 158–200px on desktop and 115–142px on mobile. Every section uses the same heading block (eyebrow, H2 with blue period, grey intro). The dark Take section is the only change of pace. Judgement item for the vision review. |
| 11 | Brand differentiation | **CONFIRMED** | Cover the logo and name and the five dossiers share one composition: dark hero, image right, same section order and sizes. Only the photographs differ. Partly intended (one system), but no per-brand signal exists beyond the photos. |
| 12 | Pattern Reveal visual power | **CONFIRMED** | The main idea of the page is a centred ~30px headline under a row of two or three tiles (~290–500px wide), while the hero name is 95px. TOSS Pattern 01 shows a grey "no image" tile. On 1440 the section reads as a footnote to the Key Moves. |
| 13 | AI-dashboard feel | **PARTIAL** | Dossiers: low after 7.6. The Index has number columns (MOVES / PATTERNS) and a legend of chips (FACT / OBSERVED PATTERN / MARKLENS TAKE). Home has 01 / 02 / 03 numbering, a pager and 11 numbers in the first screen. No reference showed stat tiles or legends in its first screen (0/18). |

## Result

### 🔴 꼭 수정
- **Hangul in the mono font** (#1). A rendering defect on three page types, with a one-line fix per class.
- **Crops that cut printed text in official images** (#7, DANGGEUN Key Move tiles). This visually misquotes a
  first-party source, which conflicts with Brand Watch's evidence promise.

### 🟡 확인 필요
- Two different as-of dates on dossiers (#2). Decide which date the hero shows; correctness is Content QA.
- Private rows in the launch index (#4).
- Hero image re-used in the Pattern section (#6).
- Pattern section scale (#12).
- Home first-screen density and 8–9px labels; 10px category labels on the mobile Insights list (#8, #9).
- Index legend and number columns (#13).
- Home headline voice (#5). Needs a decision from the owner.
- Same template for every brand (#11).
- Uniform section rhythm (#10).
- Home switches dark and light 9 times. All 18 references keep one dominant tone with at most two contrasting bands.
- Low-information tail on mobile dossiers (#3).

### 🟢 괜찮음
- Technical health: no broken images, overflow, console errors or `/_next/image`; every image has alt.
- Restrained palette: a single accent, no gradient or glass UI, no rounded shadow cards (0 measured on every page).
- Dossier hero after 7.6, and the dark MarkLens Take section.
- Official first-party imagery with visible credit.
- Mobile body text size (14–20px).
- Insight detail first screen: 19 text blocks, 0 numbers. Comparable to the Atlantic (12) and Monocle (18) articles.

### Found outside the 13
- `.bw-asof` "기준" in mono (added to #1).
- The DANGGEUN Pattern → Timeline repeat (added to #6).
- `DESIGN_PROMPT.md` still describes the old "Linear meets Notion / no blue" direction. See the note at the top of
  [design-bible.md](design-bible.md).
