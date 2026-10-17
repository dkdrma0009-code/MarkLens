# References (V1, captured 2026-10-17)

**What was captured:** each site was opened in headless Chrome. The homepage and one current article or detail page
were captured at 1440 and at 390 with `tools/design-audit.mjs`. The captures are first-screen and full-page screenshots
plus measurements.

**Overlays:**
- Pages covered by consent, paywall or newsletter overlays were captured a second time, with large fixed overlays and
  blur filters removed, so the page underneath could be seen.
- That pass is a research-only variant and is not part of the repo tool.
- Overlays were recorded as an observation in their own right (pattern P15).

**What was excluded:** generic SaaS dashboards. Dribbble or showcase shots are not evidence.

**Counts:** 19 sites attempted. 1 fully blocked (Rest of World, bot check on every page). 18 observed.
Pattern counts in [patterns.md](patterns.md) use **N = 18**, unless a pattern needs the article page. Two article
pages could not be seen: McKinsey (access denied) and The Verge (subscription wall after one screen). For those
patterns, **N = 16**.

Fast Company was tried as a business-media reference and refused the request (HTTP 403) before any page loaded. It is
not counted.

| # | Site | URL | Cat. | Why selected | Captured |
|---|---|---|---|---|---|
| 1 | The Atlantic | theatlantic.com | A Editorial | Benchmark for editorial authority: serif voice, restrained color, illustration-led articles | home + article, 1440/390 |
| 2 | The Verge | theverge.com | A Editorial | Strong brand expression in a tech-news context; tests how far identity can push | home; article behind wall after 1 screen |
| 3 | It's Nice That | itsnicethat.com | A Editorial | Creative-industry editorial; type-led features | home + article (cookie layer removed) |
| 4 | Wallpaper* | wallpaper.com | A Editorial | Design and lifestyle magazine with a classic masthead | home + article (heavy ads) |
| 5 | Rest of World | restofworld.org | B Intelligence | Global tech and business reporting | **blocked** (bot check) |
| 6 | Semafor | semafor.com | B Intelligence | Structured news format that separates fact from view | home + article (signup wall removed) |
| 7 | Business of Fashion | businessoffashion.com | B Intelligence | Industry intelligence on brands and retail: closest subject match to Brand Watch | home + article |
| 8 | McKinsey Featured Insights | mckinsey.com/featured-insights | B Research | Research publisher; insight packaging for business readers | home; article access denied |
| 9 | Marketing Brew | marketingbrew.com | B Intelligence | Marketing trade media: the direct subject peer | home + article |
| 10 | Highsnobiety | highsnobiety.com | C Brand/Culture | Brand-culture media; photography-first | home + article |
| 11 | Dezeen | dezeen.com | C Brand/Culture | Design news; image-led density | home + article |
| 12 | Monocle | monocle.com | C Brand/Culture | Brand, business and culture with a strong print identity | home + article |
| 13 | LongBlack (롱블랙) | longblack.co | C Brand/Culture (KR) | Korean premium brand-story media; Korean typography reference | home + article |
| 14 | Careet (캐릿) | careet.net | C Trend (KR) | Korean trend media for marketers; closest Korean audience peer | home + article |
| 15 | The Pudding | pudding.cool | D Experimental | Visual essays; data storytelling | home + article (interactive) |
| 16 | Works in Progress | worksinprogress.co | D Experimental | Long-form magazine with a print-issue system and mono details | home + article |
| 17 | Stripe Press | press.stripe.com | D Experimental | Book publisher site; object-led, cinematic restraint | home + book page |
| 18 | Our World in Data | ourworldindata.org | E Data | Research-grade data publication: evidence and source display | home + article |
| 19 | Pew Research Center | pewresearch.org | E Data | Survey research reports: findings-first structure | home + report |

## What each site showed (observed only)

**The Atlantic**
- **Type:** serif headlines (46px desktop / 38px mobile on the article) and a typewriter-style mono for dates, bylines,
  share and credits ("Illustration by Leon Edler"). Measured mono share: 26–30% of characters.
- **Article layout:** centred narrow column; one large commissioned illustration under the dek.
- **Homepage:** dense image + headline grid, ruled sections, red used only for "Subscribe".
- **Interruptions:** a podcast promo bar and a "start a free trial" strip interrupt reading.

**The Verge**
- **Home:** a dark page with a giant rotated wordmark and a mint accent. Brand expression is the loudest of the set.
- **Article:** a full electric-purple field with a large sans headline (65px) and a mono byline column on the left,
  then a full-width lead image. A subscription wall follows after the first screen.
- **Ads:** a Korean film ad sits above the masthead.

**It's Nice That**
- **Feature page:** opens with a full-width red field and the subject typeface at poster scale.
- **Home:** a feed strip of small thumbnails, then one huge feature image; floating pill navigation at the bottom.
- **Interruptions:** a cookie bar and a purple newsletter panel.

**Wallpaper\***
- **Type and chrome:** serif headlines, a red asterisk logo, an uppercase category nav.
- **Article:** a centred column with a breadcrumb kicker (DESIGN & INTERIORS ▸ TABLEWARE).
- **Ads:** they take most of the first screen.

**Semafor**
- **Paper and masthead:** cream paper background, serif headlines and a clock-strip masthead.
- **Article:** centred serif headline, then byline with photo, then a date and section kicker (CEO SIGNAL · BUSINESS).
- **Lead image:** a black-and-white portrait with the subject's name set large in a dotted serif and one yellow dot.
- **Sections:** the body is split by labelled serif-caps sections ("¶ THE SIGNAL INTERVIEW") above a rule.
- **Interruptions:** a sign-up and invitation wall blurs the page until dismissed, and house ads separate sections.

**Business of Fashion**
- **Type:** serif headline (52px) and serif dek. A yellow "BoF PROFESSIONAL" pill is its only accent.
- **Home:** lists with many uppercase section labels (up to 24 in the first screen).
- **Interruptions:** a membership paywall on the article.

**McKinsey Featured Insights**
- **Home:** sans headlines (64px), abstract 3D artwork as thumbnails, and two full-width dark navy bands for featured research.
- **Interruptions:** a cookie layer.

**Marketing Brew**
- **Article:** sans headline (44px desktop) with **serif body text** (75% serif characters); a teal accent; a two-up lead image.
- **Interruptions:** the newsletter sign-up block appears twice on the home.

**Highsnobiety**
- **Article:** opens with a full-bleed portrait photo; the headline is set *on* the photo, with photographer credits on the image.
- **Home:** a long black page of photo tiles.
- **Interruptions:** an email capture modal on the home.

**Dezeen**
- **Image-first density:** many small thumbnails with short captions, plus repeated "exclusive" tags on images.
- **Ads and interruptions:** ad slots above the masthead and a newsletter modal on mobile.

**Monocle**
- **Masthead and grid:** a serif masthead; a newspaper grid of serif headlines with small uppercase section labels.
- **Dark accent band:** a single dark band for Monocle Radio.
- **Interruptions:** a yellow subscription bar ("You have 2 free articles remaining").

**LongBlack**
- **Daily note:** one note per day, with "TODAY" and a **countdown timer** (13:15:15) until the note locks.
- **Type:** Korean headlines in a bold sans at about 40px desktop / 32px mobile; meta in small grey sans; no mono.
- **Interruptions:** green promotional banners interrupt the article.

**Careet**
- **Brand look:** bright lime brand field, a mascot illustration and a script logo.
- **Article:** a modest headline (20px measured) and a boxed table of contents at the top.
- **Interruptions:** a modal promo on the home.

**The Pudding**
- **Home:** dark background, issue-numbered stories (#225 · OCT 2026) in mono, a colour field per story, a hand-lettered logo.
- **Article:** a full-screen interactive scene.

**Works in Progress**
- **Print-issue system:** "Issue" navigation, a mono UI (GT America Mono measured on the home h1 and labels) and a pale paper background.
- **Article:** a full-width illustration with the title on a yellow tab; a centred column with side notes.

**Stripe Press**
- **Object-led design:** a dark page where 3D book objects stack as you scroll.
- **Restraint:** almost no UI text in the first screen (13 blocks, 0 numbers); serif book titles.

**Our World in Data**
- **Article:** serif title (40px), byline, "Cite this work" / "Reuse this work", then an in-page section nav
  (Introduction / Key Insights / Data Explorer).
- **Charts:** a key-insights carousel, then chart grids, each with its source.

**Pew Research Center**
- **Report:** dark-background serif headline (36px), an italic findings dek ("Nearly 4 in 10 U.S. adults…"),
  REPORT | date kicker, a table of contents, and inline charts with notes.
