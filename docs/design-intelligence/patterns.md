# Repeated patterns (V1)

**Sample:** N = 18 observed sites ([references.md](references.md)). Article-level patterns use N = 17: the McKinsey
article could not be opened, while The Verge's first article screen was visible.

**Method:** each count names its sites, so it can be checked against the screenshots. Measured numbers come from
`tools/design-audit.mjs`; visual counts come from the first-screen and full-page captures.

**TREND STRENGTH** is how common the pattern is in this sample right now:
- **HIGH:** 12 or more of 18
- **MEDIUM:** 6–11
- **LOW:** 5 or fewer

It says nothing about quality. **MARKLENS FIT** is judged against the [Design Bible](design-bible.md).

| ID | Pattern | Observed | Sites | Why it may be appearing | Useful for MarkLens? | Risk | Trend | Fit |
|---|---|---|---|---|---|---|---|---|
| P1 | One dominant lead (headline or image) owns the article's first screen | 16/17 | All except Wallpaper* (ads take the first screen) | Readers decide in one screen; social and search land on articles | Yes. Dossier and Insight heroes already do this; Pattern does not (#12). | Low | HIGH | HIGH |
| P2 | Lead image at full content width or full-bleed | 11/17 | Atlantic, Verge, It's Nice That, Wallpaper*, BoF, Marketing Brew, Highsnobiety, Dezeen, Pudding, WIP, Stripe Press | Photography as the main signal of seriousness | Yes, where MarkLens has first-party images large enough | Official images are often small or carry printed text, so a wide crop can cut words (N6) | MEDIUM | HIGH |
| P3 | Standard article headlines at 34–65px on desktop; poster scale kept for one feature moment | 12/12 measurable article h1s in 34–65px | Atlantic 46, Verge 65, It's Nice That 40, Wallpaper* 36, Semafor 34, BoF 52, Marketing Brew 44, Monocle 48, LongBlack 40, OWID 40, Pew 36, WIP 48. Poster type: It's Nice That, Highsnobiety. | Scale contrast works only if it is rare | Partly. MarkLens heroes are larger (68–95px), which is identity, but the Pattern headline (~30px) sits far below its hero. | Shrinking heroes would lose identity | HIGH | MEDIUM |
| P4 | One accent colour, or none, in the UI chrome | 13/18 | Atlantic, Wallpaper*, Semafor, BoF, McKinsey, Marketing Brew, Highsnobiety, Dezeen, Monocle, WIP, Stripe Press, OWID, Pew. Loud: Verge, It's Nice That, Pudding, LongBlack, Careet. | Authority reads as restraint | Yes. Already F2 (Electric Blue only). | None | HIGH | HIGH |
| P5 | Serif headlines | 10/18; Korean sites 0/2 | Atlantic, Wallpaper*, Semafor, BoF, McKinsey, Monocle, WIP, Stripe Press, OWID, Pew | Print heritage; "editorial" shorthand | Weak. No Korean serif in the system; Korean references use bold sans. | Changes A2's voice; Korean serif display is hard to do well | MEDIUM | LOW |
| P6 | Mono or typewriter face for metadata (dates, bylines, tags) | 5/18 | Atlantic (26–30% of characters), Verge, Marketing Brew, Pudding, WIP | Signals "data / record"; pairs with serif or sans | Yes. MarkLens already does it, **for Latin and numbers only**. | Hangul in mono (#1) | LOW | HIGH |
| P7 | Small uppercase kicker above the headline | 9/18 | Atlantic, Verge, Wallpaper*, Semafor, Marketing Brew, Monocle, Pew, McKinsey, BoF | Cheap orientation (section or format) | Yes, already present | Too many per screen becomes interface (#13) | MEDIUM | HIGH |
| P8 | Stat tiles, legends or number columns in the first screen | **0/18** | none. The largest count was 5 standalone numbers (Verge article); in Pew and OWID the numbers sit inside sentences. | — | No. This is where MarkLens Home (11 numbers) and the Index (8 numbers + legend) differ from every reference. | Dashboard feel | LOW | — (anti-pattern) |
| P9 | Flat modules: image + headline separated by rules and space, no shadow cards | 16/18 | All except Careet and LongBlack (rounded promo blocks). Measured rounded cards: 0–4 on every reference page. | Grid of a publication, not an app | Yes, already F4 | None | HIGH | HIGH |
| P10 | Gradient or glass as UI chrome | **0/18** seen as content chrome | Measured gradients on Semafor and LongBlack are dotted rules and promo art | — | No (N1) | — | LOW | — (anti-pattern) |
| P11 | One dominant background tone, with at most two contrasting bands | 18/18 (all full pages reviewed) | Light with 0–2 dark bands: most. Whole-dark identity: Verge, Pudding, Highsnobiety, Stripe Press. | Calm pacing; the dark band means "feature" | Yes. MarkLens Home switches dark/light 9 times (`DLDLDLDLD`); dossiers use one dark Take band, which fits. | Home loses some drama if reduced | HIGH | HIGH |
| P12 | Findings first: key insights, a numbered finding in the dek, labelled sections | 3/17 (2/2 data sites) | OWID (Key Insights), Pew ("Nearly 4 in 10…"), Semafor ("¶ THE SIGNAL INTERVIEW") | Intelligence readers want the answer before the method | Yes. Current Signal and Snapshot are this idea. | Over-structuring into a form | LOW | HIGH |
| P13 | In-page table of contents for long pieces | 3/17 | OWID, Pew, Careet | Long reports need wayfinding | Maybe, on long Insights. The dossier TOC was removed on purpose in 7.6. | Brings the section nav back into the hero | LOW | MEDIUM |
| P14 | Headline or name set on the photograph | 5/18 | Highsnobiety, Semafor, It's Nice That, WIP, LongBlack | Photography and type as one image | Only on MarkLens' own fields | Official images can't be overprinted; printed text inside them clashes | LOW | LOW |
| P15 | Subscription interruptions: walls, modals, bars, timers | 10/18 | Atlantic, Verge, It's Nice That, Semafor, BoF, Highsnobiety, Dezeen, Monocle, LongBlack (countdown), Careet | Revenue | No | Trust; the most damaging pattern in the set | MEDIUM | LOW |
| P16 | Masthead or wordmark at display scale as identity | 7/18 | Monocle, Semafor, Verge (rotated), Atlantic, Pudding, Careet, Dezeen | Brand recall in a feed-driven world | No. The A2 wordmark is fixed (F1). | Identity drift | MEDIUM | LOW |
| P17 | Issue or serial numbering as an editorial device | 3/18 | Pudding (#225), WIP (Issues), Monocle (print issue) | Makes a digital publication feel collected | Possibly for Weekly | Numbering that is navigation rather than reading order reads as UI (#13) | LOW | MEDIUM |
| P18 | Credit line on the lead image, visible in the first screen | 3/17 | Atlantic, Verge, Highsnobiety | Rights and craft | Yes, already done (F7) | None | LOW | HIGH |
| P19 | Korean media: bold sans Korean headlines, Korean metadata in sans, no Hangul in mono | 2/2 Korean sites | LongBlack, Careet | Hangul typography | Yes (F5) | None | — | HIGH |
| P20 | Homepage as a dense image + headline grid | 11/18 homes | Atlantic, BoF, McKinsey, Marketing Brew, Monocle, Dezeen, Wallpaper*, Verge, LongBlack, Careet, Pew | Volume publishing | For the Insights list; not for the Home hero | Becomes a feed | MEDIUM | MEDIUM |
| P21 | Text under 11px (5 or more elements on a page) | 6/18 | Atlantic, Semafor, BoF, Wallpaper* (mobile home 132), Monocle (mobile home 119), OWID | Dense metadata | No. MarkLens Home has 60, down to 8px. | Readability | LOW | — |

## Reading the table

- **Strong and fits:** P1, P4, P9, P11. MarkLens already follows P4 and P9. The gaps are P1 (Pattern section) and P11 (Home).
- **Partial and fits:** P2, P6, P7, P12, P18. These are mostly present already. The work is execution: crop, scale,
  and Hangul in mono.
- **Trend, but does not fit:** P5 serif headlines, P15 subscription interruptions, P16 display mastheads.
- **What MarkLens does that no reference does:** P8, number and legend UI in the first screen (0/18), and
  frequent dark/light switching on Home (0/18).
