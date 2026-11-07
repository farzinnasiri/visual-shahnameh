# Visual Shahnameh: agent guide

A browser-only, Persian (RTL) visual Shahnameh. Scrolling moves the camera
forward through paintings while the couplets appear one by one, over a
generative score. It is a static Vite + TypeScript site; paintings are
served by Cloudflare Workers Static Assets in production; R2 is an optional
future migration (`DEPLOY.md`).

The book is 61 chapters (داستان), 645 sections (بخش). Each chapter is one
file, `text/chapters/NN.json`, and that file is the text. A section id is
`chapter.place`: `10.01` is the first section of chapter 10. The number
before the dot is always the chapter. Chapter 07 has no `07.13`; that empty
heading belongs to `07.14`, which redirects the old address. Copy the
couplets from the chapter file. Name the section file, paintings, prompt,
manifest and report with that same id.
The unit of work is
one **section**: its couplets, 3–40 paintings (about one per 3–6 couplets), a score. Many agents build
sections in parallel; nothing they build touches a shared file.

There are two jobs. Read the one you were given.

- **Orchestrator:** someone said "build the next N chapters/sections" or
  "spawn N agents". You plan, claim, launch builders, then verify.
- **Builder:** you were given one or more section ids to build.

Everything a builder needs is in this repo:

| Need | Where |
| --- | --- |
| The full text (verbatim) | `text/chapters/NN.json` (`text/README.md`) |
| What exists, what is next, claims | `node scripts/next_sections.mjs` |
| Look, motion, architecture | `DESIGN.md` |
| Painting rules and prompt template | `art/STYLE.md` |
| Recurring characters | `art/characters/*.md` |
| Scoring and the sound library | `sound/SOUND.md`, `src/content/sound.ts` |
| Worked examples | `src/content/sections/02-01.ts` (a story), `01-01.ts` (the opening), and their `art/prompts/*.md` |
| The builder brief | `docs/BUILDER_BRIEF.md` |
| Checking a section | `node scripts/check_section.mjs <id>` |

## Setup (once per machine)

```sh
pnpm run setup          # pnpm install + a Python venv with Pillow (AVIF encoding)
pnpm run status         # how much is built, what is claimed, what is next
```

Also needed: Playwright's Chromium (`pnpm exec playwright-core install chromium` if
`check` can't find a browser) and `ffmpeg` for loudness checks.

## Orchestrator: "build the next N …"

Before selecting work, follow the [shared-claim workflow](README.md#reserve-work-before-starting).
GitHub Issues coordinate contributors across forks. The script below reads
only local claims; check upstream claim issues separately and reserve the
chosen section ranges there before generating paintings.

1. **Read the request.** "Chapters" usually means the book's chapters
   (داستان), each of which may have many sections; "sections" or
   "sub-chapters" means sections. If it only gives a number of agents,
   take the next sections in book order. When in doubt, use the next N
   *sections* and say which you chose.
2. **Plan the bundles.** Contiguous sections go to the same builder so a
   story's characters and paintings stay consistent:
   ```sh
   node scripts/next_sections.mjs --chapters 5 --agents 10    # next 5 of the 61 chapters, in 10 balanced bundles
   node scripts/next_sections.mjs --count 50 --agents 50      # the next 50 sections, one each
   ```
   The output is JSON: per agent, its sections with titles and couplet counts.
3. **Claim every section** before launching, so another orchestrator or a
   later run can't take it:
   `node scripts/next_sections.mjs --claim <id> --by <agent-name>` (exit 1 if
   it is taken or built: drop it from the plan).
4. **Arrange image generation in Codex.** Contributors must use their own
   Codex account and Codex app. Plan batches around their generation limits;
   wait or reduce concurrency when needed. Never publish local account labels.
5. **Launch one builder per bundle** with `docs/BUILDER_BRIEF.md`: fill in the
   section list and contributor-provided Codex setup, and pass the whole brief.
   Builders work in this same folder; they do not need branches or worktrees.
6. **When they finish,** run
   `node scripts/check_section.mjs <every id>` and look at each
   `work/checks/<id>/sheet-desktop.jpg`. Write `work/batch-<date>.md`:
   per section ✓/✗ from the check, the builder's report summary, problems,
   and what to improve in this guide. Release claims of sections that were
   not finished: `--release <id>`.
7. **Do not commit or deploy** unless the owner asks. Uploading art to R2 is
   part of deploying (`DEPLOY.md`).

### Image generation

All painting generation uses the contributor's own **Codex account and Codex
app**. Visual Shahnameh itself does not generate images, broker accounts or
provide credentials. Never assume access to another person's account.

Give Codex the prompts and paths and ask for 1536×1024 PNGs in
`art/incoming/<id>/`. If the contributor explicitly authorizes delegation to
their configured Codex agent, use only the identifier they supply locally.
Keep personal account mappings, limits and internal task links out of Git.

## Builder: build a section

Follow `docs/BUILDER_BRIEF.md`; it is the complete checklist. In short:

1. Claim (if the orchestrator didn't), read the couplets, plan the arc.
2. Write `art/prompts/<id>.md` (and character sheets), generate paintings
   into `art/incoming/<id>/`, review each one, convert with
   `pnpm art:convert art/incoming/<id> public/art/<id> --delete-source`.
3. Write `src/content/sections/<id>.ts` **last** (the site picks it up the
   moment it exists).
4. Score it, run `pnpm check <id>` until it passes, look at the sheets.
5. Write `reports/<id>.md`. The section is not done without it.

## Rules

- **Your files only.** A builder creates and edits only:
  `src/content/sections/<id>.ts`, `art/prompts/<id>.md`,
  `art/manifest-<id>.json`, `art/incoming/<id>/`, `public/art/<id>/`,
  `reports/<id>.md`, and new files in `art/characters/`. Everything else is
  shared: don't edit `src/engine`, `src/styles`, `src/home`,
  `src/content/*.ts`, `scripts`, or the docs. Propose changes in your report.
- **Keep the repository concise.** Section reports belong in `reports/<id>.md`.
  Put batch logs, investigations, comparisons and other temporary notes in the
  ignored `work/` directory. Do not add a public report for routine changes.
- **No shared registry.** Sections are discovered from
  `src/content/sections/`, and the "next section" link is worked out from
  the table of contents. There is nothing to register or link.
- **Don't run `pnpm build` or `pnpm dev` during a parallel run.** Builds
  write the shared `dist/`, and dev servers collide on ports.
  `check_section.mjs` starts its own server.
- **Text is verbatim** from `text/chapters/NN.json`: spelling and ZWNJ
  included. The check enforces it. The PDF is only for checking a doubtful line.
- **Paintings are immutable.** Never overwrite a painting file that may
  already be uploaded; a redone painting gets a new name
  (`04-razm-2.avif`). That's what lets the CDN cache them forever.
- **Tokens only:** no raw colours or font names outside
  `src/styles/tokens.css`. No letter-spacing on Persian text. Persian digits
  for numerals shown to readers.
- Engine changes affect every section. Keep `src/engine` generic; a new
  capability goes into the `Section`/`Scene` types and `DESIGN.md` first.

## Package manager

Use pnpm 12.16.1, pinned in `package.json`. Run `make install` to install the
locked dependencies with `pnpm install --frozen-lockfile`. Commit `pnpm-lock.yaml`
when changing dependencies. Keep each package root independent; pnpm shares package
contents through its global store. Do not commit `node_modules` or create npm/yarn
lockfiles. Dependency build permissions live in `pnpm-workspace.yaml`.
