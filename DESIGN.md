# Visual Shahnameh: design foundations

This is the source of truth for how the visual Shahnameh looks, moves and is
built. Every chapter should feel like a page of the same book. Read this file
before adding a section. If you need to break a rule, change the rule here
first and say why.

Related files:

- `art/STYLE.md`: the painting style and the image-prompt template
- `sound/SOUND.md`: the score, its vocabulary and how to score a section
- `art/prompts/01-01.md`: a worked example of scene prompts for one section
- `text/README.md`: the full Shahnameh text and how to get a section's couplets
- `AGENTS.md`: the step-by-step checklist for adding a section

---

## 1. The idea

**Reading the Shahnameh as a journey inward.** Each section (بخش) is a series
of paintings. The reader never scrolls a page up or down. Scrolling moves the
camera *forward*: into the painting's luminous centre, through a portal of
gold light, and into the next painting. The couplets appear in the space in
front of the camera, one at a time, while the painting they belong to fills
the screen.

Three ideas carry the whole design:

1. **Depth, not length.** Progress means going deeper. The bright centre of
   each painting is a doorway, and the reader is always moving toward a light.
2. **The manuscript, lit at night.** The visual language is the illuminated
   Persian manuscript: lapis, gold, nastaliq, page rulings and cloud bands.
   Everything is seen by lamplight, against a deep lapis-black.
3. **The verse comes first.** Images serve the poem. A couplet is never
   hidden, crowded or rushed, and nothing competes with it while it is on
   screen.

What it should not feel like: a scrolling web page, a slideshow, a game UI or
a fantasy poster.

## 2. The reader's path through a section

**Before a section: the home page** (`#/`, `src/home/`). The gateway painting
(`00-dargah`) fills the screen and is alive:
- it breathes slowly toward its light;
- it leans away from the pointer;
- rays turn out of the light, gold clouds drift across the lower world and dust floats;
- «شاهنامه» sits above *The Shahnameh · The Book of Kings*. Ferdowsi's name
  belongs beneath this title group. All other reader-facing labels and chapter
  names are Persian. Reading and contents links are immediately available.
- The home page offers «ادامه‌ی خواندن» when this browser has a saved reading
  position, with the chapter, section title, verse count and a small progress
  line. It does not redirect automatically. A first visit offers «آغاز خواندن».
  A versioned local record saves meaningful reading progress while reading and
  on page hide or departure. Merely opening a threshold or a review URL does
  not replace it. Invalid or unavailable storage must not prevent reading.

There are two ways in:
- **آغاز خواندن** opens the first section, or **ادامه‌ی خواندن** resumes the saved section without a timed redirect or full-screen flash.
- **فهرست** goes to the contents page.

The threshold music (the `threshold` atmosphere) plays on the home page and
the contents page too, and crossfades into the section's score.

**The contents** (`#/contents`, `src/home/contents.ts`). Every story remains
an illustrated Persian arch. The collection uses native vertical scrolling and
responsive grids grouped by the book's ages. There is no wheel interception or
sideways scroll conversion. The fixed lower age bar jumps to each group and
marks the visible age. Built stories show their first painting; forthcoming
stories retain their rosettes and a clear availability label.

One story (`#/contents/09`) pairs its arch, title, facts and first readable
section with a numbered list. The whole page scrolls together. On phones the
arch becomes a compact companion to the heading. Display type has positive
line boxes and explicit gaps; negative margins must not pull Nastaliq into
adjacent labels, ornaments or subtitles.

Navigation is a persistent group of separate labelled controls: Home, Contents,
and one level back. In a section, back opens its chapter; in a chapter it returns
to that chapter's place in the collection. Browser history also restores the
reading beat or collection position. Route loads are versioned so a stale async
load cannot replace a newer destination. Critical artwork is decoded before
mounting; navigation does not use full-page light flashes or shared-element
view transitions.

The book uses 61 chapter entries, defined by `text/chapter-map.json` and
generated into the source and reader contents. Permanent section IDs come
from the original PDF grouping. A section's parent is its enclosing chapter
in the contents, never its ID prefix. Regrouping keeps section URLs, paintings
and saved reading positions intact.
When a wrapped PDF heading created a spurious empty section, source generation
can join it to the adjacent text section without changing the latter's ID.
`sectionAliases` in the generated contents redirects retired IDs to that
canonical reading route. Aliases never appear as extra entries in the contents.

```
threshold   →  dive  →  scene 1  →  dive  →  scene 2  → … →  last scene  →  ending
(title on an     (portal   (couplets     (portal                                (night gathers,
 illuminated     opens)     appear one    opens)                                  closing page)
 page)                       by one)
```

| Moment | What the reader sees |
| --- | --- |
| **Threshold** | The section's first painting fills the screen, never framed like a picture on a wall. Night gathers beneath its light, and the title sits there: the kicker («شاهنامه‌ی فردوسی · The Book of Kings»), the chapter (when it differs from the section), the section title in gold nastaliq, a headpiece, the couplet count, and a short scrolling hint above the reading controls. The first scroll fades the title and starts the push-in. |
| **Dive** | A circle of the next painting opens from the screen centre, edged by a ring of gold light. Gold cloud bands rush past, gold dust streaks outward and the outgoing painting accelerates toward the camera. It should feel like falling gently into the light. |
| **Scene** | The painting fills the screen and drifts slowly closer (constant push-in). Its couplets appear one at a time: each comes out of a blur, holds still to be read, then rushes past the camera. The camera drifts toward the painting's focal point. |
| **Ending** | The last painting recedes beneath a deep lapis veil. Its detail remains faintly visible around a quiet central glow and gold ornament. Ivory and gold text names the section and the next one, with a button to return to the start. There is no white flood. |

Music follows the same path: each scene has an atmosphere, each couplet is
answered, portals ring and the ending settles into night. See `sound/SOUND.md`.

The persistent top navigation is separate from the quiet section title. A
compact lower reading control groups previous, the current couplet count, and
next. At the threshold next is labelled «شروع خواندن»; at the ending it opens the
next available section. Buttons, keyboard and trackpad use the same reading
stops. A 2px gold progress line fills from right to left. The small sound toggle
(«آوا») stays below the reading controls on the same central axis.

## 3. Art direction

The full rules are in `art/STYLE.md`. In short:

- **Style:** Timurid–Safavid manuscript painting (Herat and Tabriz, 15th–16th
  century), set at night. Mineral pigment and shell gold on burnished paper,
  flat stacked space, and no Western shading.
- **Composition:** one luminous focal point per painting, ideally at the
  centre. Key content stays inside the central 45% width, because phones
  crop the sides. Paintings run full-bleed with no text or frame.
- **The divine is never depicted.** Show it as light, veils, order and
  absence.
- **Light layers** (cloud bands, sparks) are painted in gold on pure black and
  composited with `screen`.
- **Format:** 3:2 landscape at 1536×1024, generated as PNG into
  `art/incoming/<section>/`, then converted to AVIF (q70, 4:4:4, about
  0.5 MB) in `public/art/<section>/` with `scripts/optimize_art.py`. The PNGs
  are deleted: at ~10,000 paintings the originals would need tens of GB. The
  AVIF measured sharper than the old WebP at a smaller size (SSIM 0.958 vs
  0.92).
- **Characters** that recur have sheets in `art/characters/` (STYLE rule 10).

Typical scene arc: a section's paintings should **progress**, not just
illustrate. 01.01 moves from a threshold on earth, past a lamp, out through
the heavens, to a final veil. Plan the arc before writing prompts, and make
each painting's centre a believable doorway to the next.

## 4. Colour

Tokens live in `src/styles/tokens.css`. Their names are the painter's pigments.

| Token | Hex | Use |
| --- | --- | --- |
| `--lajevard-1000` | `#03040a` | Page background, darkest night |
| `--lajevard-950` | `#05070f` | Stage edges |
| `--lajevard-900` | `#0b1230` | Stage centre glow |
| `--lajevard-800` | `#13204f` | Ink-blue headings on paper, buttons |
| `--lajevard-600` | `#1f3a8a` | Lapis: frame band, hover |
| `--tala-100…700` | `#fbf1cf → #8a6a22` | Shell gold: titles, rules, ornament (the 200/400 steps are the workhorses) |
| `--shangarf` | `#c8442b` | Vermilion accent. Rare; never for text |
| `--firouzeh` | `#3fa7a3` | Turquoise accent |
| `--zangar` | `#2e7d6b` | Malachite accent |
| `--kaghaz` | `#f2e8d3` | Warm paper and interface text |
| `--morakkab` | `#1d140b` | Ink: text on paper |

The rules:

- **Gold on night** is the default pairing, including the closing view.
- Verse text uses solid warm ivory (`--verse-ink`), without a stroke or shadow.
  Gold remains the accent for titles, rules and ornaments. One translucent
  lapis panel with a fine border and soft corners suppresses busy detail. Text colours never sample
  or oscillate with the moving painting.
- Accents come from the paintings. The interface never adds colour of its own.

## 5. Typography

| Role | Face | Notes |
| --- | --- | --- |
| Verse, titles | **Noto Nastaliq Urdu** 400/700 (`--font-verse`) | The only open-licence nastaliq with good Persian shaping. Line-height ≥ 1.9, because nastaliq's descenders and diagonal stacking need the room. Never apply letter-spacing to Persian text: it breaks the joins. |
| Interface | **Vazirmatn** variable (`--font-ui`) | Header, counts, buttons. Small sizes, quiet. |
| English | **Cormorant Garamond** 500 / 400 italic (`--font-latin`) | The book's English name on home only. Small caps tracking is fine here (Latin), never on Persian. |

Sizes are fluid tokens: `--verse-size` (≈25–50px), `--title-size`
(≈38–74px), and `--ui-size` (13px). Fonts are self-hosted through
`@fontsource`, so there are no third-party requests, and the first frame waits
for `document.fonts.ready`.

Text conventions:

- Copy the poem's text **verbatim** from `text/shahnameh.json`, including its
  spelling and ZWNJ (`نگارنده‌ی`).
- All numerals shown to the reader are Persian (`toPersianDigits`).
- Interface copy is short, plain Persian (for example «برای ورود، به پیش
  بروید», «بازگشت به آغاز»).

## 6. Verse layout

- **Every screen:** the first hemistich sits above the reading anchor and the
  second below it, with a small gold star between them. The anchor is slightly
  below the painting's centre, aiming at 60% of viewport height and moving up
  when necessary to leave room for controls. Both may wrap. Desktop text
  stays within the central reading column; phones use up to 92vw.
- **Legibility:** solid ivory words sit above one fitted frosted lapis panel,
  with a fine highlighted edge and soft corners. A dark translucent tint
  preserves contrast as painting colours show through. A modest backdrop blur
  operates in a separate fixed verse layer outside the clipped painting stage.
  Unsupported filtering or reduced transparency uses the solid tinted fallback.
  The panel height comes from the tallest actual couplet in its scene, including
  wrapped lines and padding. It keeps its size and opacity between couplets.
  No hard stripe through the words and no adaptive colour switching in a dive.
- **One couplet at a time.** Each holds for most of its beat. Readers who stop
  scrolling see it completely still.

## 7. Motion

Everything on stage is a pure function of one number, the **beat** `u`
(1 beat = one viewport height of scrolling). There are no time-based
animations on stage except the dust's idle drift and the hint ring.

| Constant | Where | Value | Why |
| --- | --- | --- | --- |
| `BEATS.threshold` | `timeline.ts` | 1.5 | Time to read the title and enter the page |
| `BEATS.dive` | `timeline.ts` | 1.15 | Long enough to feel the fall, short enough to stay exciting |
| `BEATS.couplet` | `timeline.ts` | 1.3 | One deliberate scroll gesture per couplet, with a held middle |
| `BEATS.ending` | `timeline.ts` | 1.9 | The closing veil and title need room to settle |
| `PUSH_IN` | `journey.ts` | 0.08/beat | Constant forward drift (exponential, so the speed feels steady) |
| `FOLLOW` | `journey.ts` | 7/s | Touch input follow; desktop already uses the detent spring and receives no second easing |
| `OVERSCAN` | `journey.ts` | 1.12 | Paintings are drawn 12% larger than "cover", so drift never shows an edge |
| `SENSITIVITY` | `detents.ts` | 2.2 | Wheel distance to beats: one swipe or two notches reaches the next couplet |
| `HOLD`, `HOLD_WIDTH` | `detents.ts` | 0.5, 0.15 beats | Near a couplet the wheel moves at half speed: a couplet holds under a light touch |
| `STIFFNESS` | `detents.ts` | 100, critically damped | The settle spring: no bounce and a quicker response |
| `COMMIT` | `detents.ts` | 0.08 beats | A released gesture that moved this far carries on to the next couplet, however long the gap |

**Friction** (`src/engine/detents.ts`). Every couplet's hold, the threshold
and the end are detents.
- **Wheel and trackpad:** a gesture slows near a detent. It can never pass
  more than one detent, so flings and momentum tails never skip a couplet.
  Between detents it scrubs freely, so a dive can be watched slowly. When it
  ends, a critically damped spring settles into a detent, biased toward the
  direction of travel.
- **Keys and reading buttons:** Down/Left, Space and PageDown advance one
  couplet; Up/Right, Shift-Space and PageUp reverse. Both animate through the
  same beat positions and portal choreography as scrolling, using the settle
  spring. A new input can interrupt the trip. Home and End jump to the ends.
  Reduced motion keeps these steps immediate. On touch screens, buttons use
  the same spring while finger scrolling retains native momentum and snapping.
- **Touch screens:** native momentum with CSS `scroll-snap-stop: always`.

The choreography:

- **Couplet:** appears over the first 24% of its beat (opacity, blur 7→0px,
  scale 0.92→1), holds and drifts slightly, then leaves over the last 24%
  (scale to about 1.16, blur, fade), so it seems to pass the camera.
- **Dive:** the portal radius grows with the square of progress (it starts
  slowly, then you fall), and the outgoing painting scales by up to 2.8×
  (cubic ease-in). The gold rim and the cloud layer peak in the middle.
  Paintings and their circular reveal are drawn together into one viewport
  canvas, capped at 1.5 device pixels per CSS pixel. Each frame clears and
  redraws the visible paintings, so a browser never composites a changing
  CSS mask over a separately transformed image. Light and dust remain above
  the flattened painting bitmap. The reading panel uses its opaque fallback
  during a dive and for 0.4 beats after reveal, so backdrop filtering does
  not sample the changing portal.
- **Focus drift:** the painting slides toward its `focus` point only as far
  as its current size allows without exposing an edge. Off-centre focal
  points are reached as the camera zooms in.
- **Dust:** about 160 gold motes in 3D. They drift slowly at rest and streak
  outward with scroll speed. This is the main cue that scrolling means
  moving forward.

**Reduced motion** (`prefers-reduced-motion`): no push-in, no portal, no
blur, no dust, no clouds. The camera follows the scroll directly, scenes
crossfade and verses fade in place.

## 8. Architecture

A static site: Vite + TypeScript, no framework and no backend. It deploys to
Vercel (or any static host) as `dist/`.

```
index.html              entry; lang="fa" dir="rtl"
src/main.ts             hash router (#/ home, #/contents, #/01.01 a section), fonts
src/home/               home page (home.ts), contents page (contents.ts), toc type
src/engine/detents.ts   scroll friction: detents, resistance, settle spring
src/engine/reading-progress.ts  versioned local reading position and storage fallback
src/engine/sound-toggle.ts  the «آوا» button and when sound may start
src/styles/contents.css contents styles
public/favicon.*        the شمسه icon (svg, ico, apple-touch-icon, 512px png)
src/content/toc.json    the 61 chapters and their Persian section titles
text/chapter-map.json   chapter organization and permanent source section ranges
src/content/types.ts    Section / Scene / Couplet types: the content contract
src/content/index.ts    discovers sections/*.ts (no list to edit), lazy imports
src/content/sections/   one file per section, NN-NN.ts: couplets + scenes + sound
src/content/art.ts      painting URLs (local /art/ or R2 via VITE_ART_BASE)
src/engine/timeline.ts  section → beats (pure; no DOM)
src/engine/journey.ts   DOM, scroll input, per-frame rendering
src/engine/dust.ts      canvas gold dust
src/engine/ornament.ts  SVG illumination (headpiece, verse star)
src/engine/sound.ts     the generative score (Web Audio)
src/content/sound.ts    sound vocabulary + atmosphere library (data)
src/styles/tokens.css   design tokens
src/styles/journey.css  all styles
public/art/<section>/   paintings (AVIF); not in git, master copy in R2
art/                    style guide, prompts, manifests, character sheets
docs/BUILDER_BRIEF.md   the brief for agents building sections
reports/                one report per section, plus batch reports
work/                   claims and check output (local, not in git)
DEPLOY.md               Cloudflare: site on Workers static assets, paintings on R2
sound/                  the score's design guide (SOUND.md)
text/                   the full Shahnameh as JSON + Markdown
src/styles/home.css     home page and contents styles
scripts/                next_sections (plan/claim), check_section, optimize_art, art_upload,
                        text extraction, screenshots, score renders
```

Decisions, and why:

- **Native scroll holds the position.** A tall invisible track supplies
  scroll length while the stage stays `position: fixed`.
  - **Touch:** keeps native momentum, with snap points at each couplet.
  - **Wheel and keys:** go through `Detents`, which writes `scrollY`. Without
    it, a single fling skipped several couplets.
  - **Assistive tech:** still reads the hidden article.
- **A 2D canvas on a fixed stage.** Depth is drawn as scaled paintings and
  circular portals in one bitmap. This avoids stale tiles from CSS masks over
  transformed images during reverse scrubbing. Persian text stays real DOM
  text, preserving shaping and accessibility. Light and dust are separate
  overlays.
- **Hash routing** (`#/01.01`) means no server rewrites are needed.
- **No shared registry.** Section files are discovered with
  `import.meta.glob`, and the closing page's "next section" is worked out
  from `toc.json` plus which files exist (`src/main.ts`). So parallel builders
  never edit the same file.
- **Paintings off the site.** Paintings are served from R2 on a custom domain
  (`DEPLOY.md`); the site itself stays a few MB. Painting files are
  immutable, so they are cached for a year.
- **Lazy loading:** each section's content is a separate chunk, and paintings
  load only around the reader (one behind, two ahead).
- **Accessibility:** the stage is `aria-hidden`. A visually hidden `<article>`
  holds the full section text in reading order, and every scene has a Persian
  `alt`.

### Review aid: `?beat=`

`/?beat=3.3#/01.01` freezes the camera at beat 3.3 and ignores scrolling, so
any moment can be inspected or screenshotted. In dev, `window.__journey.freezeAt(u)`
moves the frozen camera without a reload (handy for frame-by-frame sweeps,
for example measuring brightness across a dive). Capture several:

```sh
pnpm dev --port 5199
node scripts/shoot.mjs 1440x900 /tmp/shot 0 3.3 15.2 --port 5199
node scripts/shoot.mjs 390x844  /tmp/phone 0 3.3 --port 5199
.venv/bin/python -I scripts/sheet.py /tmp/shot /tmp/sheet.jpg 2 0 3.3 15.2
```

To find beats, see `buildTimeline`. In 01.01 the first couplet holds around
3.3, and each later couplet is 1.3 beats on, plus 1.15 for each dive.

## 9. Known limits

- Paintings are 1536px wide, the image model's limit. On large retina
  screens, deep zoom makes them a little soft. The originals are not kept,
  so an upscale would have to start from the AVIF.
- AVIF only: browsers without AVIF (Safari before 16) show the dark
  placeholder instead of paintings.
- Noto Nastaliq is designed for Urdu. A few Persian letterforms (final ه)
  are slightly Urdu in flavour. A licensed Persian nastaliq would be an
  upgrade.
- The score is synthesised (see `sound/SOUND.md`). It is evocative but not a
  real ensemble, and it is on by default, but browsers block audio until the
  reader's first click, tap or key, so a reader who lands on a section and
  only scrolls hears nothing until they tap the pulsing toggle. There is no recitation.

## 10. Reading and navigation refinements, 2026-11-05

Navigation must remain available on the threshold and ending. An explicit
chapter-back link is independent of browser history. Buttons and arrow keys
move to the same stop as one trackpad gesture. Horizontal trackpad gestures and
pinch zoom are left to the browser. Starting a second gesture must not teleport
the scroll position to the previous spring target. The camera follows the
already-smoothed controller directly rather than applying a second easing.

Home, contents and chapter headings retain the manuscript palette and arches.
Their labels and actions are immediately available, without delayed entrance
stagger or timed redirects. Existing content and paintings remain unchanged.

### Central reading column

Portrait stacked verses use the available width with 1.5rem side insets and
the `--portrait-verse-size` token, which responds to both viewport width and
height with a 1.125rem floor. Apply this typography before measuring each
scene's tallest wrapped couplet; short phones must retain room for the art.

Farzin's direction on 2026-11-05 is the governing layout rule: keep the eye in
the middle third of a desktop screen. All headings, contents, chapter lists,
poems and controls share `--book-width`, approximately 34vw capped at 38rem.
Phones use the available width with side insets. Paintings remain full-bleed.
Both hemistichs stack above and below the lower reading anchor on every screen size. The
navigation is centred above; reading controls and sound are centred below.
Contents uses two arches per row inside this column, not a shelf across the
whole screen. A chapter's compact introduction stays above its section list.

### Portrait painting and verse composition

On portrait viewports at most 760px wide, sections default to a stacked
reading composition. A quiet, soft full-bleed rendering of the current
painting remains behind the stage. The complete 3:2 painting is fitted,
without stretching or an ornamental frame, into the upper available region;
the measured verse panel occupies a separate lower region. Principal details
must not depend on fitting inside the narrow slice of a full-height cover
image or on remaining visible through an opaque verse card.

The top navigation and lower reading controls define the available vertical
space. The tallest measured pair of hemistichs in each scene determines one
stable panel height, including its asymmetric above/below extents and padding.
The painting uses the remaining space above that panel with a clear gap.
There is no minimum art height that can force an overlap with text or controls.
If enlarged text cannot fit between navigation and controls, the couplet
becomes a naturally scrolling card inside that available region. Navigation
stays outside the card; overflow never silently falls back to an obstructed
stacked frame.

`Section.portraitLayout` can explicitly retain `"immersive"` for a section;
`"stacked"` is the default. Desktop, landscape and the threshold retain
their immersive presentation; the final portrait painting remains beneath
the ending veil and colophon. Existing scene images, couplet timing and sound
are unchanged, and `Scene.focus` continues to identify the luminous dive target,
not a character or a substitute composition anchor.

Ordinary portrait reading keeps the whole-image frame bounded; it does not
morph into full-height cover or keep zooming until essential details leave
the frame. Eight pixels of inner art space protect the fitted image from the
region's edges. During a portrait dive, the outgoing image zooms around its
actual painted light while the verse fades; the portal, rim and glow originate
at that framed light. The incoming painting's light initially aligns with the
portal and settles into its natural fitted frame by the first verse hold.
The full-bleed backdrop prevents empty stage edges. The reduced-motion
presentation retains a static fit and uses a quiet crossfade instead of a
spatial zoom or camera flight. Desktop dive geometry is unchanged.
