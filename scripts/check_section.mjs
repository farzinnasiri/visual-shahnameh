// Check one or more built sections end to end. Builders run it before they
// finish; reviewers rerun it. Self-contained: it starts its own Vite server on
// a free port, so any number of agents can run it at once.
//
//   node scripts/check_section.mjs 03.01 [04.01 ...] [--quick] [--keep-frames]
//
// Checks (✗ = fails the section, ! = warning):
//   text      couplets verbatim from text/chapters/NN.json, every couplet in exactly one scene, in order
//   scenes    scenes[0] is the threshold (no couplets); every scene has a sound; painting budget
//   art       every painting exists as public/art/<id>/*.avif, loads, is 1536x1024, under the size cap
//   files     art/prompts/<id>.md, art/manifest-<id>.json, reports/<id>.md exist
//   types     tsc errors in this section's file
//   render    no page errors; screenshots of the threshold, every couplet, every dive and the ending
//             at 1440x900 and 390x844 (--quick: a sample), tiled into contact sheets
//   sound     offline render of the score: peak below -1 dBFS, loudness -26..-20 LUFS (needs ffmpeg)
//
// Output: work/checks/<id>/ (screenshots, sheet-desktop.jpg, sheet-phone.jpg,
// score.m4a, result.json). Exit code 1 if any section fails.
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook } from "./book.mjs";

const MAX_PAINTING_KB = 900;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const quick = process.argv.includes("--quick");
if (!ids.length) {
  console.error("usage: node scripts/check_section.mjs <id> [<id>...] [--quick]");
  process.exit(2);
}
const book = loadBook(root);
const source = Object.fromEntries(book.chapters.flatMap((c) => c.sections.map((s) => [s.id, s])));
const sourceChapters = Object.fromEntries(book.chapters.flatMap(c => c.sections.map(s => [s.id, { id: c.id, title: c.title }])));

// Typecheck once for all sections (tsc --noEmit writes nothing, so it is safe in parallel).
const tsc = spawnSync(join(root, "node_modules/.bin/tsc"), ["--noEmit", "-p", root], { encoding: "utf8" });
const tscErrors = (tsc.stdout || "").split("\n").filter((l) => /error TS/.test(l));

const server = await createServer({ root, logLevel: "error", server: { port: 5300 + Math.floor(Math.random() * 600), strictPort: false, watch: null, hmr: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const cache = `${homedir()}/Library/Caches/ms-playwright`;
const dir = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().pop() : null;
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (dir ? `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` : undefined);
const browser = await chromium.launch({ executablePath });

let failed = 0;
for (const id of ids) {
  const r = await check(id);
  failed += r.errors.length ? 1 : 0;
  console.log(`\n${r.errors.length ? "✗" : "✓"} ${id} ${source[id]?.title ?? ""}`);
  for (const e of r.errors) console.log(`  ✗ ${e}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
  for (const [k, v] of Object.entries(r.info)) console.log(`    ${k}: ${v}`);
}
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);

async function check(id) {
  const errors = [];
  const warnings = [];
  const info = {};
  const slug = id.replace(".", "-");
  const out = join(root, "work/checks", id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const done = () => {
    writeFileSync(join(out, "result.json"), JSON.stringify({ id, at: new Date().toISOString(), errors, warnings, info }, null, 1) + "\n");
    return { errors, warnings, info };
  };

  const src = source[id];
  if (!src) return errors.push(`no section ${id} in text/chapters`), done();
  const file = join(root, "src/content/sections", `${slug}.ts`);
  if (!existsSync(file)) return errors.push(`missing src/content/sections/${slug}.ts`), done();
  for (const f of [`art/prompts/${slug}.md`, `art/manifest-${slug}.json`, `reports/${slug}.md`]) {
    if (!existsSync(join(root, f))) errors.push(`missing ${f}`);
  }
  const mine = tscErrors.filter((l) => l.includes(`sections/${slug}.ts`));
  if (mine.length) errors.push(`type errors:\n      ${mine.join("\n      ")}`);
  else if (tscErrors.length) warnings.push(`${tscErrors.length} type errors elsewhere in the project (not this section)`);

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("response", (res) => res.status() >= 400 && pageErrors.push(`${res.status()} ${res.url()}`));
  await page.goto(`${base}/?beat=0#/${id}`);
  await page.waitForFunction(() => window.__journey, null, { timeout: 30000 }).catch(() => {});

  // Section data and timeline, from the real modules.
  const data = await page.evaluate(async (id) => {
    const { sections } = await import("/src/content/index.ts");
    const { buildTimeline } = await import("/src/engine/timeline.ts");
    const { resolveSound } = await import("/src/content/sound.ts");
    if (!sections[id]) return { missing: true };
    const s = await sections[id]();
    const t = buildTimeline(s);
    const imgs = await Promise.all(
      [...new Set([...s.scenes.map((x) => x.image), s.lightLayer].filter(Boolean))].map(
        (src) =>
          new Promise((ok) => {
            const im = new Image();
            im.onload = () => ok({ src, w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => ok({ src, w: 0, h: 0 });
            im.src = src;
          }),
      ),
    );
    return {
      id: s.id,
      chapter: s.chapter,
      couplets: s.couplets,
      scenes: s.scenes.map((x, i) => ({ image: x.image, couplets: x.couplets, hasSound: x.sound !== undefined, atmosphere: x.sound === undefined ? null : !!resolveSound(x.sound, i ? "contemplative" : "threshold").atmosphere })),
      imgs,
      beats: {
        threshold: 0,
        couplets: t.couplets.map((c) => +((c.start + c.end) / 2).toFixed(2)),
        dives: t.scenes.slice(1).map((x) => +((x.diveStart + x.revealed) / 2).toFixed(2)),
        end: +(t.total - 0.05).toFixed(2),
      },
    };
  }, id);
  if (data.missing) {
    await page.close();
    return errors.push("section file exists but is not discovered (file name must be NN-NN.ts and export `section`)"), done();
  }

  // ---- text
  if (data.id !== id) errors.push(`section.id is "${data.id}", expected "${id}"`);
  const chapter = sourceChapters[id];
  if (data.chapter.id !== chapter.id || data.chapter.title !== chapter.title) {
    errors.push(`chapter must match text/chapters/${chapter.id}.json: ${chapter.id} · ${chapter.title}`);
  }
  const want = src.couplets;
  if (data.couplets.length !== want.length) errors.push(`has ${data.couplets.length} couplets, the text has ${want.length}`);
  want.forEach((c, i) => {
    const got = data.couplets[i];
    if (got && (got[0] !== c[0] || got[1] !== c[1])) errors.push(`couplet ${i + 1} differs from text/chapters/${id.slice(0, 2)}.json`);
  });
  const order = data.scenes.flatMap((s) => s.couplets);
  if (order.join() !== want.map((_, i) => i + 1).join()) errors.push(`scene couplets must be 1..${want.length}, each once, in order (got ${order.join(",")})`);

  // ---- scenes
  if (data.scenes[0]?.couplets.length) errors.push("scenes[0] is the threshold and must have no couplets");
  data.scenes.forEach((s, i) => {
    if (!s.hasSound) {
      if (i > 0) errors.push(`scene ${i} has no sound`); // the threshold defaults to "threshold"
    } else if (!s.atmosphere) errors.push(`scene ${i} has an unknown sound`);
  });
  const paintings = data.scenes.length;
  // About one painting per 3-6 couplets, at least 3, at most 40 (+1 threshold).
  const most = Math.min(40, Math.max(8, Math.ceil(want.length / 3))) + 1;
  const least = Math.min(40, Math.max(3, Math.floor(want.length / 6))) + 1;
  if (paintings > most) warnings.push(`${paintings} paintings for ${want.length} couplets; aim for at most ${most}`);
  if (paintings < least) warnings.push(`${paintings} paintings for ${want.length} couplets; aim for at least ${least}`);
  const longest = Math.max(...data.scenes.map((s) => s.couplets.length));
  if (longest > 8) warnings.push(`a scene holds ${longest} couplets; keep it to about 3-6`);
  info.paintings = paintings;
  info.couplets = want.length;

  // ---- art
  let bytes = 0;
  for (const im of data.imgs) {
    const local = join(root, "public", new URL(im.src, base).pathname);
    if (!im.w) errors.push(`painting does not load: ${im.src}`);
    else if (im.w !== 1536 || im.h !== 1024) errors.push(`${im.src} is ${im.w}x${im.h}, expected 1536x1024`);
    if (!im.src.endsWith(".avif")) errors.push(`${im.src} is not AVIF (run scripts/optimize_art.py)`);
    if (existsSync(local)) {
      const kb = statSync(local).size / 1024;
      bytes += kb;
      if (kb > MAX_PAINTING_KB) warnings.push(`${im.src} is ${Math.round(kb)} KB (cap ${MAX_PAINTING_KB})`);
    }
  }
  const artDir = join(root, "public/art", slug);
  if (existsSync(artDir)) {
    const used = new Set(data.imgs.map((i) => new URL(i.src, base).pathname.split("/").pop()));
    const unused = readdirSync(artDir).filter((f) => !used.has(f));
    if (unused.length) warnings.push(`unused files in public/art/${slug}: ${unused.join(", ")}`);
  }
  if (existsSync(join(root, "art/incoming", slug))) warnings.push(`art/incoming/${slug} still exists; convert with --delete-source`);
  info.art = `${Math.round(bytes / 1024 * 10) / 10} MB`;

  // ---- render
  const shots = { desktop: [], phone: [] };
  const sample = (list) => (quick ? list.filter((_, i) => i % Math.max(1, Math.ceil(list.length / 4)) === 0) : list);
  const beats = [0, ...sample(data.beats.couplets), ...sample(data.beats.dives), data.beats.end];
  for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    await page.setViewportSize(vp);
    await page.goto(`${base}/?beat=0#/${id}`);
    await page.waitForFunction(() => window.__journey, null, { timeout: 30000 });
    for (const u of beats) {
      await page.evaluate((u) => window.__journey.freezeAt(u), u);
      await page.waitForFunction(() => {
        const j = window.__journey;
        return j && j.scenes.filter((node) => node.requested).every((node) => node.ready);
      }, null, { timeout: 20000 });
      await page.waitForTimeout(250);
      const path = join(out, `${label}-${String(u).padStart(6, "0")}.jpg`);
      await page.screenshot({ path, type: "jpeg", quality: 70 });
      shots[label].push({ path, u });
    }
  }
  if (pageErrors.length) errors.push(`page errors: ${[...new Set(pageErrors)].slice(0, 5).join(" | ")}`);
  for (const [label, list] of Object.entries(shots)) await sheet(list, join(out, `sheet-${label}.jpg`), label === "phone" ? 6 : 4);
  // Keep only the sheets: single frames add up to hundreds of MB across the book.
  if (!process.argv.includes("--keep-frames")) for (const list of Object.values(shots)) for (const { path } of list) rmSync(path);
  info.screenshots = `${shots.desktop.length + shots.phone.length} → work/checks/${id}/sheet-desktop.jpg, sheet-phone.jpg`;

  // ---- sound
  // Screenshots are complete. Release the live canvas before the long offline
  // render so it does not keep competing for CPU/GPU throughout the score.
  await page.evaluate(() => window.__journey?.destroy());
  const wav = await page.evaluate(async (id) => {
    const { sections } = await import("/src/content/index.ts");
    const { Sound } = await import("/src/engine/sound.ts");
    const buf = await Sound.renderScore(await sections[id](), 22050);
    let peak = 0;
    const ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const n = buf.length;
    const view = new DataView(new ArrayBuffer(44 + n * 4));
    const text = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); text(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, buf.sampleRate, true); view.setUint32(28, buf.sampleRate * 4, true);
    view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 2; c++) {
        const v = ch[c][i];
        peak = Math.max(peak, Math.abs(v));
        view.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true);
      }
    const u8 = new Uint8Array(view.buffer);
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { data: btoa(s), seconds: n / buf.sampleRate, peak };
  }, id);
  await page.close();
  const wavPath = join(out, "score.wav");
  writeFileSync(wavPath, Buffer.from(wav.data, "base64"));
  const peakDb = 20 * Math.log10(wav.peak || 1e-9);
  info.sound = `${wav.seconds.toFixed(0)}s, peak ${peakDb.toFixed(1)} dBFS`;
  if (peakDb > -1) errors.push(`score peaks at ${peakDb.toFixed(1)} dBFS (limit -1)`);
  const ff = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-y", "-i", wavPath, "-af", "ebur128=framelog=verbose", "-c:a", "aac", "-b:a", "128k", join(out, "score.m4a")], { encoding: "utf8" });
  if (ff.error || ff.status !== 0) {
    const message = `sound measurement failed: ${ff.error?.message ?? ff.stderr.slice(-1000)}`;
    if (ff.error?.code === "ENOENT" && !process.env.CI) warnings.push(message);
    else errors.push(message);
  }
  else {
    const lufs = Number([...ff.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1]);
    info.sound += `, ${lufs} LUFS`;
    if (!(lufs >= -26 && lufs <= -20)) errors.push(`score loudness ${lufs} LUFS (want -26..-20)`);
    rmSync(wavPath);
  }
  return done();
}

/** Tile screenshots into one contact sheet, rendered by the browser itself. */
async function sheet(list, path, cols) {
  if (!list.length) return;
  const p = await browser.newPage({ viewport: { width: 1800, height: 800 } });
  const imgs = list.map(({ path, u }) => `<figure><img src="data:image/jpeg;base64,${readFileSync(path).toString("base64")}"><figcaption>${u}</figcaption></figure>`).join("");
  await p.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;top:2px;left:4px;font:12px sans-serif;color:#fff;background:#0008;padding:0 4px}</style>${imgs}`);
  await p.waitForTimeout(200);
  await p.screenshot({ path, fullPage: true, type: "jpeg", quality: 75 });
  await p.close();
}
