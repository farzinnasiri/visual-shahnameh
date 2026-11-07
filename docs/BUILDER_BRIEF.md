# Builder brief

The orchestrator fills in the section list and passes this whole file to each
builder. A builder can also be started by hand with it.

---

You are building sections of the **Visual Shahnameh** in
the current checkout. It is a browser-only Persian site: scrolling moves the
camera into paintings while couplets appear in gold nastaliq, over a generative score.
Other agents are building other sections in the same folder at the same time.

**Your sections:** {{SECTIONS}}  (ids like `03.01`; file slugs like `03-01`)
**Image generation:** your own Codex account, in your Codex app.

## Read first

`AGENTS.md` (rules: which files are yours), `DESIGN.md`, `art/STYLE.md`,
`art/characters/README.md`, `sound/SOUND.md`. Then study one finished
section end to end: `src/content/sections/02-01.ts` with
`art/prompts/02-01.md` (a story with characters, battle and mourning).

## For each section, in order

1. **Claim it** (skip if the orchestrator did):
   `node scripts/next_sections.mjs --claim <id> --by <your name>`. If it
   fails, the section is taken: skip it.
2. **Get the text:**
   ```sh
   python3 -I -c "import json,sys; cid,=sys.argv[1].split('.')[:1]; d=json.load(open(f'text/chapters/{cid}.json')); s=next(x for x in d['sections'] if x['id']==sys.argv[1]); print(d['id'], d['title']); print(s['title']); [print(i+1,a,'/',b) for i,(a,b) in enumerate(s['couplets'])]" <id>
   ```
   Read all of it. Read the previous section's file (if built) so your
   opening follows from its ending.
   The file is the chapter. Use its `id` and `title` for the section's
   `chapter` field. There are 61 chapters. `09.01` is the first section of
   chapter 09, in `text/chapters/09.json`. Do not open the PDF to choose a number.
3. **Plan the arc.** Group couplets into scenes of about 3–6 that share one
   painting; `scenes[0]` is the threshold with no couplets. Paintings per
   section: about one per 3–6 couplets, at least 3, at most 40. The paintings
   should *progress* (DESIGN.md §3), and each painting's bright centre is a
   doorway into the next.
4. **Characters.** For every recurring figure, use `art/characters/<name>.md`
   if it exists; otherwise write it (STYLE rule 10). Paste the prompt line
   unchanged into each prompt.
5. **Write `art/prompts/<slug>.md`:** the arc, then one entry per painting
   (file name, couplets, the full prompt from the STYLE template).
6. **Generate the paintings in your own Codex app**, using your own Codex
   account: 1536×1024 PNGs into `art/incoming/<slug>/`, named as in your
   prompts file. Record the final prompt of each in `art/manifest-<slug>.json`
   (same shape as the others). Visual Shahnameh has no image-generation
   feature and provides no accounts. Give Codex the prompts and output paths;
   ask it to report every file written. If generation is rate-limited, wait
   and retry with your own Codex setup. Keep account identifiers private.
7. **Review every image yourself** against `art/STYLE.md`: no text or
   letters, no frame, one luminous focal point near the centre, key content
   composed in the central 45%, miniature style at night, characters matching their
   sheets, no anachronisms, no depiction of God, the Prophet or the Imams.
   Redo any that fail; a redo gets a new file name.
   The 45% rule is composition guidance, not a promise that an immersive
   camera or a dive will preserve that area at every viewport and zoom.
8. **Convert:**
   `pnpm art:convert art/incoming/<slug> public/art/<slug> --delete-source`
   (AVIF, about 0.5 MB each; the PNGs are deleted, which is intended).
9. **Write `src/content/sections/<slug>.ts` last.** Copy the structure of
   `02-01.ts`: `import { LIGHT_LAYER, sectionArt } from "../art"`,
   `const art = sectionArt("<id>")`, verbatim couplets, scenes with Persian
   `alt`, `focus` for any painting whose light isn't centred, and a `sound`
   for every scene (`sound/SOUND.md`; cues on the couplets the text names).
   Keep `focus` on the actual painted light, not on a face or an empty point.
   Portrait reading defaults to the whole painting above a separate measured
   verse region, with a soft full-bleed backdrop. `portraitLayout: "immersive"`
   explicitly retains the cover/overlay presentation; it needs its own viewport
   review. No `next` field: links are automatic.
10. **Check:** `node scripts/check_section.mjs <id>` until it prints ✓. Then
    open `work/checks/<id>/sheet-desktop.jpg` and `sheet-phone.jpg` and
    look: every couplet readable, dives opening onto light, no exposed
    edges, characters consistent. Fix what you see and re-run.
    Before expanding a multi-section illustration batch, use a representative
    completed section as an early reader preview: inspect the first and last
    verse of each representative scene and its dive at 320×568, 390×844 and a
    desktop size. Use real converted paintings and complete reader content,
    not placeholders. Check that ordinary portrait reading keeps the whole
    painting separate from the verse card, including wrapped text; inspect
    the light transition separately. Deliberate transition cropping is not a
    requirement that every face remain visible during every verse.
11. **Write `reports/<slug>.md`** (template below). This file is how your
    work is evaluated; the check fails without it.

Don't run `pnpm build` or `pnpm dev`, don't edit files that aren't yours
(see `AGENTS.md`), don't commit.

## When you finish

Your final message lists each section with ✓/✗ from the check and the path
of its report. Keep it short: the reports hold the detail.

## Report template (`reports/<slug>.md`)

```md
# <id> <title>

Builder: <model/tool> · Images: Codex · Started <time> · Finished <time>

## Scenes
| # | Painting | Couplets | Shows | Sound |
| --- | --- | --- | --- | --- |

## Characters
Sheets used / created.

## Paintings redone
Which, and why.

## Check
Paste the summary printed by check_section.mjs.

## Problems and suggestions
Anything unclear or slow in the docs, tools or image generation; anything left imperfect.
```
