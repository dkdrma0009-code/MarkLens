# Adoption queue V1

**What this is:** each item is a candidate, not a change.
**Approval:** nothing here is applied until the owner approves it.

**Reading the IDs:**
- P = pattern ([patterns.md](patterns.md))
- F / X / N = Design Bible rule ([design-bible.md](design-bible.md))
- # = baseline issue ([baseline-2026-10.md](baseline-2026-10.md))

## ADOPT — fits the identity, low risk, evidence on both sides

| ID | Change | Reason (one line) | Evidence |
|---|---|---|---|
| A1 | Korean text never in mono: Korean labels switch to the sans; mono stays for Latin and numbers | Geist Mono has no Hangul, so it is a rendering defect, not a style | #1, F5; Korean refs 2/2 use sans for Korean meta (P20). **Applied in V1.1** with the shared `.ml-hangul` class (4 places). |
| A2 | Images with printed type (posters, banners) are never cropped by `cover`. Use `contain`, a wider frame or a registered focus. | Cutting a source's own words visually misquotes the evidence | #7, N6. **Applied in V1.1 to DANGGEUN** (광고 MCP and 지구를 위한 동네모임 posters, `fit: "contain"`). **V1 final:** the OLIVE YOUNG City Log image (logo cut at the top) also moved to `contain`. Checked by eye and left as is: OLIVE YOUNG FESTA (25%, the sign stays whole) and TOSS mini-apps (38%, only background cut). Still open: the DANGGEUN lead image at 390 (a 10% crop clips the first glyph of its subtitle). |
| A3 | Do not re-use a page's hero or Key Move image at full size in Pattern. Use a different first-party image, or a small captioned citation. | The repeat reads as a shortage of material | #6, N5 |
| A4 | No legends, stat tiles or number columns in a first screen | 0 of 18 references put them there; they are the main source of the dashboard feel | P8, #9, #13 |
| A5 | 12px floor for visible metadata, 11px absolute minimum (no 9–10px) | Home has 60 elements under 11px; 9 of 18 references have none and only 6 have 5 or more | #8, X3. **V1 final:** FACT labels raised to 11px. Still open: Home (8–9px), index head, footer (10px). |
| A6 | Before any public UI merge, run `tools/design-audit.mjs` and the vision review on the changed pages | Turns these rules into a repeatable check | audit-rules.md |

## EXPERIMENT — promising; test one at a time with before/after captures

| ID | Change | Reason (one line) | Risk |
|---|---|---|---|
| E1 | Pattern as a feature spread: one dominant image and a headline closer to the hero scale | The page's main idea is currently its smallest moment (P1, P2, #12) | Longer page; must keep fact/interpretation separation (F6) |
| E1-B | **Tested in V1.1 on BAEMIN (local QA only, not in the public build):** a text-led reveal. Supporting moves become a compact list with 88px reference thumbnails; a bracket and blue stem lead to the Pattern statement at 78px (was 46px), in the wider column. | The statement becomes the page's clearest moment without a large repeated photo. The page is 0.4 screens shorter at 1440 and +53px at 390. | **ADOPTED** after the owner's approval as B′, in `brands.css` and `BrandDossier.tsx`. The adopted version has 120px / 80px references, statements at 72px, and a compact size for statements over 32 characters. The no-image plate no longer collides with the number. Checked on all five brands. The one-photo variant was rejected, because every BAEMIN visual already appears large above. |
| E2 | One as-of date in the dossier hero (the Snapshot date), with "Updated" moved to the page footer | Two dates side by side read as a contradiction (#2) | Needs a Content QA decision on which date leads |
| E3 | Launch index without "— —" rows: show private brands as a short "준비 중" line under the list, or leave them out | Empty rows look broken next to full ones (#4) | The watchlist looks shorter |
| E4 | Home with one dominant tone and at most two dark bands | 18/18 references keep one tone; Home switches 9 times (P11) | Changes Home's character; needs before/after captures |
| E5 | Mobile dossier tail: collapse the Timeline and Sources lists behind a "전체 보기" | The last third is low-information small text (#3) | Sources must stay one tap away (F6) |
| E6 | Section spacing by role (opening, evidence, idea, reference) instead of one gap size | Breaks the uniform rhythm (#10, X1) | Easy to over-tune; measure the gaps |
| E7 | Per-brand difference through the lead photograph (larger, possibly full-bleed hero image), not through new colors | Brands currently differ only by small photos (#11) | Must not add brand colors to UI (F2, N10) |

## HOLD — interesting, but not now

| ID | Pattern | Why hold |
|---|---|---|
| H1 | Serif headlines or serif body text (P5, 10/18) | Strong in Western editorial but 0/2 in Korean references. No Korean serif in the brand system; it would change A2's voice. Revisit only as a test on Insight body text. |
| H2 | Headline set on the photo (P14, 5/18) | Allowed only on MarkLens' own fields; never on official brand images (rights and N6) |
| H3 | Issue / serial numbering (P17, 3/18) | Could suit Weekly; not a Brand Watch need |
| H4 | In-page table of contents on dossiers (P13) | Removed on purpose in 7.6 to calm the hero; reconsider only if E5 is not enough |
| H5 | Findings-first dek with the key number in the sentence (P12; Pew, OWID) | Content-dependent; would come from the editorial template, not the design |

## REJECT — trend or not, it does not fit

| ID | Pattern | Why reject |
|---|---|---|
| R1 | Interrupting subscription layers: modals, walls, timers, "N free articles" (P15, 10/18) | Most common pattern in the set, and the most damaging to trust. LongBlack's countdown is the clearest case (N7). |
| R2 | Oversized or rotated masthead as identity (P16, 7/18) | The A2 wordmark is fixed (F1) |
| R3 | Loud multi-color identity (Verge, Pudding, Careet, LongBlack promos) | Conflicts with one accent (F2) |
| R4 | Rounded promo cards and pills | SaaS grammar (N2) |
| R5 | Gradient or glass UI surfaces | Generic AI look (N1); 0/18 references use them as content chrome |
| R6 | Stat tiles, scores, rankings | Dashboard feel and the no-ranking stance (F11, N3) |
