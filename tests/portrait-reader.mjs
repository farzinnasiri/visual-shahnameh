// Browser regression for composition visibility; audio/timing is unchanged.
// Run from the repository root. Artifacts go into ignored work/portrait-reader.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const server = await createServer({ root: process.cwd(), logLevel: "error", server: { port: 0, watch: null, hmr: false } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
const output = "work/portrait-reader";
mkdirSync(output, { recursive: true });
const results = [];
const failures = [];
const samples = new Set(["01.01", "02.01", "08.02", "08.10", "08.15", "08.19", "08.25", "08.32"]);
try {
  const page = await browser.newPage();
  page.on("pageerror", error => failures.push(`Browser error: ${error.message}`));
  await page.goto(server.resolvedUrls.local[0]);
  const ids = await page.evaluate(async () => Object.keys((await import("/src/content/index.ts")).sections));
  const layoutIds = process.argv.includes("--interaction-only") ? [] : ids;
  for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    for (const id of layoutIds) {
      await page.goto(`${server.resolvedUrls.local[0]}?beat=0#/${id}`);
      await page.waitForFunction(id => window.__journey?.section.id === id, id);
      const result = await page.evaluate(async () => {
        await document.fonts.ready;
        const journey = window.__journey;
        journey.layout();
        return {
          id: journey.section.id,
          frames: journey.portraitLayouts.slice(1),
          beats: journey.timeline.couplets.filter((c, i, all) => i === 0 || i === all.length - 1).map(c => (c.start + c.end) / 2),
        };
      });
      for (const [index, frame] of result.frames.entries()) {
        const name = `${id} scene ${index + 1} at ${width}x${height}`;
        if (!frame?.fits) { failures.push(`${name}: verse overflow`); continue; }
        const art = frame.artRect;
        if (art.height < 100) failures.push(`${name}: illustration only ${art.height.toFixed(1)}px high`);
        if (art.x < 0 || art.x + art.width > width + .01 || art.y + art.height > frame.panelTop - 15.99) failures.push(`${name}: painting cropped or overlaps verse`);
        if (frame.panelTop < 0 || frame.panelBottom > height) failures.push(`${name}: verse outside viewport`);
      }
      results.push({ id, width, height, scenes: result.frames.length, minimumArtHeight: Math.min(...result.frames.filter(x => x?.fits).map(x => x.artRect.height)) });
      if (samples.has(id)) {
        for (const [index, beat] of result.beats.entries()) {
          await page.evaluate(u => window.__journey.freezeAt(u), beat);
          await page.waitForFunction(() => window.__journey.scenes.filter(n => n.requested).every(n => n.ready));
          await page.waitForTimeout(80);
          await page.screenshot({ path: `${output}/${id}-${width}x${height}-${index ? "last" : "first"}.png` });
        }
      }
    }
  }
  // Desktop/landscape and reduced-motion smoke cases exercise the live reader.
  for (const [width, height] of [[1440, 900], [844, 390], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${server.resolvedUrls.local[0]}?beat=3.3#/08.15`);
    await page.waitForFunction(() => window.__journey?.section.id === "08.15");
    assert.equal(await page.evaluate(() => window.__journey.portraitLayouts.every(x => x === null)), true);
    await page.waitForFunction(() => window.__journey.scenes.filter(n => n.requested).every(n => n.ready));
    await page.screenshot({ path: `${output}/08.15-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server.resolvedUrls.local[0]}?beat=0#/08.15`);
  await page.waitForFunction(() => window.__journey?.section.id === "08.15");
  const reveal = await page.evaluate(() => window.__journey.timeline.scenes[2].revealed);
  const origins = [];
  for (const beat of [reveal - .001, reveal + .001, reveal + .3, reveal - .575]) {
    await page.evaluate(u => window.__journey.freezeAt(u), beat);
    await page.waitForFunction(() => window.__journey.scenes.filter(n => n.requested).every(n => n.ready));
    await page.waitForTimeout(80);
    origins.push(await page.evaluate(() => {
      const style = getComputedStyle(window.__journey.stage);
      return [parseFloat(style.getPropertyValue("--portal-x")), parseFloat(style.getPropertyValue("--portal-y"))];
    }));
    await page.screenshot({ path: `${output}/08.15-transition-${beat.toFixed(3)}.png` });
  }
  assert.ok(Math.hypot(origins[0][0] - origins[1][0], origins[0][1] - origins[1][1]) < 2, "portal origin must not jump at reveal");
  const heldBeat = await page.evaluate(() => window.__journey.u);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(50);
  assert.ok(Math.abs(await page.evaluate(() => window.__journey.u) - heldBeat) < .01, "resize must preserve reading position");
  await page.evaluate(() => { window.__journey.section.portraitLayout = "immersive"; window.__journey.layout(); });
  assert.equal(await page.evaluate(() => window.__journey.portraitLayouts.every(x => x === null)), true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server.resolvedUrls.local[0]}?beat=3.3#/08.15`);
  await page.reload();
  await page.waitForFunction(() => window.__journey?.section.id === "08.15");
  assert.equal(await page.evaluate(() => window.__journey.reduced && window.__journey.portraitLayouts[1]?.fits), true);
  await page.waitForFunction(() => window.__journey.scenes.filter(n => n.requested).every(n => n.ready));
  await page.screenshot({ path: `${output}/08.15-reduced-motion.png` });
  // A very large user font must scroll inside its card, without turning pages.
  await page.goto(`${server.resolvedUrls.local[0]}#/08.02`);
  await page.waitForFunction(() => window.__journey?.section.id === "08.02");
  await page.evaluate(() => {
    const journey = window.__journey;
    journey.verses.style.setProperty("--portrait-verse-size", "96px");
    journey.layout(); journey.jumpTo(3.3);
  });
  await page.waitForFunction(() => document.querySelector(".portrait-overflow .couplet.is-visible"));
  const card = page.locator(".portrait-overflow .couplet.is-visible");
  const bounds = await card.boundingBox();
  const controls = await page.locator(".reader-controls").boundingBox();
  assert.ok(bounds.y + bounds.height < controls.y, "overflow card must leave controls accessible");
  assert.equal(await card.evaluate(el => el.scrollHeight > el.clientHeight), true);
  await card.hover(); await page.mouse.wheel(0, 300); await page.waitForTimeout(150);
  assert.ok(await card.evaluate(el => el.scrollTop > 0), "wheel must scroll the long couplet");
  assert.ok(Math.abs(await page.evaluate(() => window.__journey.u) - 3.3) < .01, "card scrolling must not advance the poem");
  await page.screenshot({ path: `${output}/08.02-large-text.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !document.querySelector(".portrait-overflow"));
  assert.equal(await page.evaluate(() => {
    const journey = window.__journey;
    const bed = journey.bed.getBoundingClientRect();
    const lines = [...journey.verses.querySelectorAll(".couplet.is-visible .hemistich")].map(el => el.getBoundingClientRect());
    return lines.every(line => line.top >= bed.top && line.bottom <= bed.bottom);
  }), true, "resizing out of overflow must remeasure the normal verse panel");
  writeFileSync(`${output}/${layoutIds.length ? "results" : "interaction-results"}.json`, JSON.stringify({ at: new Date().toISOString(), results, failures }, null, 2));
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log(`PASS: ${layoutIds.length} sections at three portrait sizes; desktop, landscape, tablet, reduced motion and reader interactions. Screenshots: ${output}`);
} finally {
  await browser.close();
  await server.close();
}
