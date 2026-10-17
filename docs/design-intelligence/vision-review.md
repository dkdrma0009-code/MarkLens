# Vision Review prompt (V1)

Use this for the questions a script cannot answer. Give a vision-capable model, or a person, the screenshots from
`tools/design-audit.mjs`: `<page>-<width>-fold.png` and `<page>-<width>-full.png` at 1440 and 390. Also give it the
`report.json` lines for the same pages, so it does not re-check what the script already measured.

Run it on one page type at a time: Home, Insights list, Insight detail, Brand Watch index, or one brand dossier.
For the brand-differentiation question, include **all five** brand dossiers in one run.

---

## Prompt

You are reviewing screenshots of MarkLens, a Korean marketing-intelligence media site.
The brand promise is "Premium Editorial Marketing Intelligence Media" and "Where Marketing Trends Become Action".
Its value order is Editorial Authority → Signal → Frame. Its visual language is:
- black / white / off-white with one accent, Electric Blue `#164BFF`
- editorial typography
- strong photography
- asymmetric composition
- high but controlled information density
- minimal decoration

Judge only what you can see. Do not judge whether facts or dates are correct; that is Content QA.
For each question, answer with one of 🔴 꼭 수정 / 🟡 확인 필요 / 🟢 괜찮음. Name the exact place on the screenshot
(section name, or "first screen, right column"). Give one plain-language sentence of reason.
If you cannot tell from the screenshot, say "판단 불가" rather than guessing.

1. **AI 대시보드 느낌.** Does any area read like a product dashboard rather than a publication? Look for:
   - rows of number tiles or stat strips (MOVES 4 / PATTERNS 2)
   - numbered menus (01 02 03) that are navigation rather than reading order
   - legends or explanatory chips that teach the interface
   - many small mono uppercase labels
   - equal-weight boxes in a grid

   One small stat line is fine. Flag it when the interface explains itself more than the content speaks.
2. **SaaS 느낌.** Does any area look like a software landing page? Look for:
   - pill badges
   - rounded cards with shadows
   - gradient or glass panels
   - icon + three-feature rows
   - "Get started" style CTAs
3. **Premium editorial.** Does the page feel edited by people with a point of view? Signs:
   - one clear lead story or image
   - a deliberate scale contrast between headline and body
   - captions and credits
   - a confident crop
   - restraint in color

   Say which single element most helps and which most hurts.
4. **Hero clarity.** In the first screen, can a reader say in five seconds what this page is and what to read first?
   Count the competing elements: headlines, images, number groups, link groups, labels. More than one dominant thing is a flag.
5. **Hierarchy.** Is there one obvious first, second and third read on the first screen, and in each major section?
   Flag sections where the title, the image and the metadata are all the same visual weight.
6. **Brand differentiation (brand dossiers only).** Cover the brand name and logo in each dossier. Can you still tell
   the five brands apart from the photography, color and composition? If they read as the same template with
   different pictures, say so. Name which dossier is the most and the least distinctive.
7. **Pattern impact (brand dossiers only).** The "Observed Pattern" section is the brand's main idea. On the 1440
   screenshot, does it hold the screen like a feature spread, or does it float small in white space?
   Compare its visual weight with the hero and the Key Moves.
8. **Crop quality.** For every photo, check whether the crop cuts:
   - text that is printed inside the image (poster or banner type, logos)
   - faces, or the product

   Name the image by its section and position. The script lists every crop of 20%+ with a reason. A large crop
   with nothing important cut is 🟢; only a cut word, face, product or logo is a problem.
9. **Rhythm.** Scroll the full screenshot. Do sections change pace (wide vs narrow, image vs text, dark vs light), or
   is every gap and every block the same size? Flag runs of three or more sections that look interchangeable.
   Also flag dark/light switches so frequent that the page flickers.
10. **Mobile fatigue (390 only).** Would a reader on a phone reach the main idea within two screens? Name any
    stretch longer than about two screens with no image, heading or change of pace. Note sections that only
    make sense on desktop, such as wide tables or side-by-side comparisons squeezed into one column.
11. **Repetition.** Does the same photo, phrase, label or section shape appear again in a way the reader would notice?
    The question is whether an image in the same role is repeated without meaning: the same photo, the same crop,
    the same message, shown large in two places (for example Key Moves and Pattern). A small reference thumbnail
    that points back to an earlier move is a citation and is fine.

Dates are not a vision question. When the script reports a DATE REVIEW, list the dates you see and leave their
meaning to Content QA.

### Output format

```
## <page> @<width>
🔴 꼭 수정
- [question #] <place> — <one sentence>
🟡 확인 필요
- ...
🟢 괜찮음
- ...
판단 불가
- ...
가장 도움이 되는 요소: ...
가장 해가 되는 요소: ...
```

Do not propose a redesign. Do not suggest new colors, gradients, glass, illustrations or rounded cards.
If you suggest a fix, keep it to one line and to existing MarkLens elements:
type scale, spacing, crop, order, removal.
