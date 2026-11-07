import test from "node:test";
import assert from "node:assert/strict";
import { computePortraitLayout } from "../src/engine/portrait-layout.ts";

const input = (width = 390, height = 844, extra = {}) => ({
  width, height, hudBottom: 64, controlsTop: height - 112,
  above: 74, below: 74, padding: 24, ...extra,
});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

function safeFrame(values) {
  const frame = computePortraitLayout(values);
  assert.ok(frame?.fits, "expected a fitting portrait frame");
  assert.ok(frame.panelTop >= values.hudBottom + 16);
  assert.ok(frame.panelBottom <= values.controlsTop - 16);
  assert.ok(frame.readingAnchor - values.above - values.padding >= frame.panelTop - 1e-7);
  assert.ok(frame.readingAnchor + values.below + values.padding <= frame.panelBottom + 1e-7);
  close(frame.panelCenter, (frame.panelTop + frame.panelBottom) / 2);
  const art = frame.artRect;
  assert.ok(art.x >= 0 && art.y >= values.hudBottom + 16);
  assert.ok(art.x + art.width <= values.width);
  assert.ok(art.y + art.height <= frame.panelTop - 16 + 1e-7);
  if (art.height > 0) close(art.width / art.height, 1.5);
  return frame;
}

test("small and large portrait phones keep full artwork separate from verses and controls", () => {
  for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    const frame = safeFrame(input(width, height));
    assert.ok(frame.artRect.height > 0, `${width}x${height} should retain illustration space`);
    // Source image corners all remain inside its visible art area; no cover crop.
    assert.ok(frame.artRect.x >= frame.artArea.x + 8);
    assert.ok(frame.artRect.y >= frame.artArea.y + 8);
    assert.ok(frame.artRect.x + frame.artRect.width <= frame.artArea.width - 8);
    assert.ok(frame.artRect.y + frame.artRect.height <= frame.artArea.y + frame.artArea.height - 8 + 1e-7);
  }
});

test("asymmetric wrapped hemistichs use their real anchor, rather than panel midpoint", () => {
  const frame = safeFrame(input(390, 844, { above: 150, below: 80 }));
  assert.ok(frame.readingAnchor > frame.panelCenter);
  close(frame.readingAnchor - frame.panelTop, 174);
  close(frame.panelBottom - frame.readingAnchor, 104);
});

test("the optional two-percent reading drift cannot push whole-image edges outside the art area", () => {
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [760, 1200]]) {
    const { artRect: art, artArea: area } = safeFrame(input(width, height));
    const extraX = art.width * .01;
    const extraY = art.height * .01;
    assert.ok(art.x - extraX >= area.x);
    assert.ok(art.x + art.width + extraX <= area.x + area.width);
    assert.ok(art.y - extraY >= area.y);
    assert.ok(art.y + art.height + extraY <= area.y + area.height);
  }
});

test("long verses consume art space without moving the card into controls", () => {
  const short = safeFrame(input(320, 568));
  const long = safeFrame(input(320, 568, { above: 138, below: 126 }));
  assert.ok(long.artRect.height < short.artRect.height);
  close(long.panelBottom, short.panelBottom);
});

test("no minimum art height is invented when only the verse can fit", () => {
  const values = input(320, 568, { above: 150, below: 138 });
  const frame = computePortraitLayout(values);
  assert.ok(frame?.fits);
  assert.equal(frame.artRect.width, 0);
  assert.equal(frame.artRect.height, 0);
  assert.ok(frame.panelBottom <= values.controlsTop - 16);
});

test("physically impossible wrapping reports overflow without unsafe drawing anchors", () => {
  const values = input(320, 568, { above: 260, below: 160 });
  const result = computePortraitLayout(values);
  assert.equal(result.fits, false);
  assert.ok(result.requiredPanelHeight > result.availablePanelHeight);
  assert.ok(result.overflowHeight > 0);
  assert.equal("readingAnchor" in result, false);
  assert.equal("artRect" in result, false);
});

test("desktop, tablet, landscape and explicit immersive sections retain existing presentation", () => {
  for (const values of [input(1440, 900), input(768, 1024), input(844, 390), input(600, 600), input(390, 844, { mode: "immersive" })]) {
    assert.equal(computePortraitLayout(values), null);
  }
  assert.ok(computePortraitLayout(input(760, 1024))?.fits);
});

test("invalid measurements cannot produce NaN canvas geometry", () => {
  assert.throws(() => computePortraitLayout(input(0, 844)), RangeError);
  assert.throws(() => computePortraitLayout(input(390, 844, { above: NaN })), RangeError);
});
