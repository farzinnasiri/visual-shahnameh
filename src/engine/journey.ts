import type { NextSection, Section } from "../content/types";
import { Dust } from "./dust";
import { headpiece, verseMark } from "./ornament";
import { Detents } from "./detents";
import { icon, navigation } from "./navigation";
import { Sound } from "./sound";
import { SoundToggle } from "./sound-toggle";
import { saveProgress } from "./reading-progress";
import { computePortraitLayout } from "./portrait-layout";
import { BEATS, buildTimeline, type Timeline } from "./timeline";
import {
  clamp,
  easeInCubic,
  easeInOutSine,
  easeOutCubic,
  el,
  lerp,
  progress,
  smoothstep,
  toPersianDigits,
} from "./util";

/** Paintings are 3:2. */
const PAINTING_ASPECT = 1.5;
/** Paintings are drawn larger than "cover" so zoom and focus offsets never show an edge. */
const OVERSCAN = 1.12;
/** Constant forward push-in, per beat. Gives the feeling of always drifting deeper. */
const PUSH_IN = 0.08;
/** How quickly the camera catches up with the scroll position (per second). */
const FOLLOW = 7;
interface SceneNode {
  img: HTMLImageElement;
  requested: boolean;
  ready: boolean;
  backdrop?: HTMLCanvasElement;
}

interface CoupletNode {
  root: HTMLDivElement;
}

/**
 * Renders one section as a forward journey. Native page scroll is the input
 * (so touch momentum, keyboard and assistive tech work as usual); the stage
 * is fixed and everything on it is a function of the beat position.
 */
export class Journey {
  private timeline: Timeline;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private coarse = window.matchMedia("(pointer: coarse)").matches;

  private track!: HTMLDivElement;
  private stage!: HTMLDivElement;
  private scenes: SceneNode[] = [];
  private world!: HTMLCanvasElement;
  private worldContext!: CanvasRenderingContext2D;
  private pixelRatio = 1;
  private couplets: CoupletNode[] = [];
  private light?: HTMLDivElement;
  private rim!: HTMLDivElement;
  private glow!: HTMLDivElement;
  private bed!: HTMLDivElement;
  private endingVeil!: HTMLDivElement;
  private threshold!: HTMLDivElement;
  private thresholdShade!: HTMLDivElement;
  private hint!: HTMLDivElement;
  private colophon!: HTMLDivElement;
  private hud!: HTMLElement;
  private hudCount!: HTMLSpanElement;
  private previousButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private bar!: HTMLDivElement;
  private dust?: Dust;
  private sound: Sound;
  private soundToggle!: SoundToggle;
  private detents?: Detents;

  private vw = 0;
  private vh = 0;
  private paintW = 0;
  private paintH = 0;

  private u = 0;
  private speed = 0;
  private lastTime = 0;
  private raf = 0;
  private lastControls = "";
  private readingHeights: number[] = [];
  private lastReadingScene = -1;
  private readingCenters: number[] = [];
  private readingPanelCenters: number[] = [];
  private portraitLayouts: ReturnType<typeof computePortraitLayout>[] = [];
  private verses!: HTMLDivElement;
  private lastCheckpointAt = -Infinity;
  private lastCheckpoint = "";
  /** When set, the camera holds here and ignores scrolling (screenshots, reviews). */
  private frozen: number | null = null;

  constructor(
    private host: HTMLElement,
    private section: Section,
    private next?: NextSection,
  ) {
    this.timeline = buildTimeline(section);
    this.sound = new Sound(section, this.timeline);
    this.build();
    this.detents = this.createDetents();
    this.layout();
    this.u = this.targetU();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.tick);
  }

  private createDetents() {
    return new Detents(this.stops(), () => this.vh, { wheel: !this.coarse, reduced: this.reduced });
  }

  /** Jump straight to a beat position without the camera easing there. */
  jumpTo(beat: number) {
    window.scrollTo(0, beat * this.vh);
    this.u = clamp(beat, 0, this.timeline.total);
    this.detents?.sync(this.u);
  }

  private step(direction: number) {
    if (this.frozen !== null) {
      this.frozen = null;
      this.soundToggle.button.hidden = false;
      this.detents = this.createDetents();
      this.detents.sync(this.u);
      window.scrollTo(0, this.u * this.vh);
    }
    if (direction > 0 && this.u >= this.timeline.total - 0.01 && this.next?.available) {
      location.hash = `#/${this.next.id}`;
      return;
    }
    if (this.detents) this.detents.step(direction);
    else {
      const stops = this.stops();
      const target = direction > 0 ? stops.find((s) => s > this.u + 0.01) : [...stops].reverse().find((s) => s < this.u - 0.01);
      if (target !== undefined) this.jumpTo(target);
    }
  }

  /**
   * Hold the camera at a beat and ignore scrolling. Used by "?beat=" so
   * headless screenshots can capture any moment without scrolling the page.
   */
  freezeAt(beat: number) {
    this.frozen = clamp(beat, 0, this.timeline.total);
    this.u = this.frozen;
    this.soundToggle.button.hidden = true;
    this.detents?.destroy();
    this.detents = undefined;
  }

  destroy() {
    this.checkpoint(true);
    if (this.frozen === null) {
      try { sessionStorage.setItem(`shahnameh.beat.${this.section.id}`, String(this.u)); } catch { /* Optional local navigation memory. */ }
    }
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pagehide", this.onPageHide);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.detents?.destroy();
    this.soundToggle.destroy();
    this.sound.destroy();
    document.documentElement.classList.remove("journey");
    this.host.replaceChildren();
  }

  private onPageHide = () => this.checkpoint(true);
  private onVisibility = () => { if (document.hidden) this.checkpoint(true); };

  private checkpoint(force = false) {
    const first = this.timeline.couplets[0];
    if (this.frozen !== null || !first || this.u < first.start + BEATS.couplet * .24) return;
    const now = performance.now();
    if (!force && (Math.abs(this.speed) > .1 || now - this.lastCheckpointAt < 1500)) return;
    let couplet = 0;
    for (const span of this.timeline.couplets) {
      if (span.start > this.u) break;
      couplet = span.number;
    }
    if (!couplet) return;
    const signature = `${couplet}:${this.u.toFixed(2)}`;
    if (signature === this.lastCheckpoint) return;
    saveProgress(this.section.id, this.u, couplet);
    this.lastCheckpoint = signature;
    this.lastCheckpointAt = now;
  }

  // ---------------------------------------------------------------- build

  private build() {
    const { section } = this;
    document.documentElement.classList.add("journey");
    document.title = `${section.title} · شاهنامه‌ی فردوسی`;

    this.track = el("div", "track", this.host);
    this.stage = el("div", "stage", this.host);
    this.stage.setAttribute("aria-hidden", "true");

    // Draw images and the portal into one bitmap. A CSS clip over a moving
    // image can leave stale compositor tiles during slow reverse scrubbing.
    this.world = el("canvas", "world", this.stage);
    this.worldContext = this.world.getContext("2d")!;
    section.scenes.forEach(() => {
      const img = new Image();
      img.decoding = "async";
      const node: SceneNode = { img, requested: false, ready: false };
      img.addEventListener("load", () => void img.decode().then(() => { node.ready = true; }).catch(() => {}));
      img.addEventListener("error", () => { node.ready = false; });
      this.scenes.push(node);
    });

    if (section.lightLayer && !this.reduced) {
      this.light = el("div", "light-layer", this.stage);
      this.light.style.zIndex = "50";
      const img = el("img", "", this.light);
      img.src = section.lightLayer;
      img.alt = "";
      img.decoding = "async";
    }

    this.glow = el("div", "portal-glow", this.stage);
    this.rim = el("div", "rim", this.stage);
    const canvas = el("canvas", "dust", this.stage);
    if (!this.reduced) this.dust = new Dust(canvas);
    el("div", "vignette", this.stage);
    for (const z of [this.glow, this.rim, canvas]) z.style.zIndex = "60";

    // Threshold: the first painting fills the screen; night gathers under the title.
    this.thresholdShade = el("div", "threshold-shade", this.stage);
    this.thresholdShade.style.zIndex = "65";
    this.threshold = el("div", "threshold", this.stage);
    this.threshold.style.zIndex = "70";
    this.threshold.innerHTML = `
      <p class="threshold__kicker">شاهنامه‌ی فردوسی</p>
      <p class="threshold__chapter"></p>
      <h1 class="threshold__title"></h1>
      ${headpiece("threshold__ornament")}
      <p class="threshold__sub"></p>`;
    // The cue to go inward stands apart, at the bottom edge.
    this.hint = el("div", "threshold__hint", this.stage);
    this.hint.style.zIndex = "70";
    this.hint.innerHTML = `<span>پیمایش کنید یا «شروع خواندن» را بزنید</span><span class="threshold__hint-line"></span>`;
    const chapterLine = this.threshold.querySelector<HTMLElement>(".threshold__chapter")!;
    if (section.title === section.chapter.title) chapterLine.remove();
    else chapterLine.textContent = `داستان ${toPersianDigits(Number(section.chapter.id))} · ${section.chapter.title}`;
    this.threshold.querySelector("h1")!.textContent = section.title;
    this.threshold.querySelector(".threshold__sub")!.textContent = `${toPersianDigits(section.couplets.length)} بیت`;

    // Verses.
    const verses = this.verses = el("div", "verses", this.host);
    verses.style.zIndex = "80";
    verses.setAttribute("aria-hidden", "true");
    // One bed of shade for the whole scene, so the screen doesn't dim and
    // brighten between couplets; only the words change.
    this.bed = el("div", "verse-bed", verses);
    for (const span of this.timeline.couplets) {
      const [first, second] = section.couplets[span.number - 1];
      const root = el("div", "couplet", verses);
      root.innerHTML = `${verseMark("couplet__mark")}
        <p class="hemistich hemistich--first"></p><p class="hemistich hemistich--second"></p>`;
      root.querySelector(".hemistich--first")!.textContent = first;
      root.querySelector(".hemistich--second")!.textContent = second;
      this.couplets.push({ root });
    }

    el("div", "grain", this.stage).style.zIndex = "90";
    this.endingVeil = el("div", "ending-veil", this.stage);
    this.endingVeil.style.zIndex = "85";

    // Accessible text: the whole section, in reading order.
    const text = el("article", "visually-hidden", this.host);
    text.innerHTML = `<h1></h1><h2></h2><ol></ol>`;
    text.querySelector("h1")!.textContent = section.chapter.title;
    text.querySelector("h2")!.textContent = section.title;
    const ol = text.querySelector("ol")!;
    for (const [a, b] of section.couplets) el("li", "", ol).textContent = `${a} / ${b}`;

    // Persistent book navigation, separate from the reading controls.
    this.hud = el("header", "hud", this.host);
    navigation(this.hud, { href: `#/contents/${section.chapter.id}`, label: "بازگشت به داستان" });
    el("p", "hud__title", this.hud).textContent = section.title;
    const controls = el("nav", "reader-controls", this.host);
    controls.setAttribute("aria-label", "خواندن شعر");
    this.previousButton = el("button", "reader-controls__step", controls);
    this.previousButton.type = "button";
    this.previousButton.innerHTML = `${icon("back")}<span>قبلی</span>`;
    this.previousButton.setAttribute("aria-label", "بیت قبلی");
    this.previousButton.addEventListener("click", () => this.step(-1));
    this.hudCount = el("span", "hud__count", controls);
    this.hudCount.setAttribute("role", "status");
    this.nextButton = el("button", "reader-controls__step reader-controls__step--next", controls);
    this.nextButton.type = "button";
    this.nextButton.innerHTML = `<span>شروع خواندن</span>${icon("next")}`;
    this.nextButton.addEventListener("click", () => this.step(1));
    const progressEl = el("div", "progress", this.host);
    this.bar = el("div", "progress__bar", progressEl);

    // Closing page.
    this.colophon = el("div", "colophon", this.host);
    this.colophon.innerHTML = `
      ${headpiece("colophon__ornament")}
      <p class="colophon__kicker">پایان بخش</p>
      <h2 class="colophon__title"></h2>
      <p class="colophon__next"></p>
      <button class="colophon__again" type="button">بازگشت به آغاز</button>`;
    this.colophon.querySelector("h2")!.textContent = section.title;
    const next = this.colophon.querySelector(".colophon__next")!;
    if (this.next) {
      next.innerHTML = this.next.available
        ? `بخش بعد: <a href="#/${this.next.id}"><strong></strong></a>`
        : `بخش بعد: <strong></strong><span class="colophon__soon">به‌زودی</span>`;
      next.querySelector("strong")!.textContent = this.next.title;
    }
    this.colophon.querySelector("button")!.addEventListener("click", () => {
      this.jumpTo(0); // cut straight back to the threshold instead of rewinding
    });

    this.soundToggle = new SoundToggle(this.host, this.sound);

    // Snap points for touch scrolling: every couplet's hold, the threshold and the end.
    for (const beat of this.stops()) el("div", "detent", this.track).dataset.beat = String(beat);
  }

  /** Where the reader comes to rest: the threshold, each couplet's middle, the end. */
  private stops() {
    const { couplets, total } = this.timeline;
    return [0, ...couplets.map((c) => (c.start + c.end) / 2), total];
  }

  // --------------------------------------------------------------- layout

  private onResize = () => {
    const keep = this.u;
    this.layout();
    window.scrollTo(0, keep * this.vh);
    this.u = keep;
    this.detents?.sync(keep);
  };

  private layout() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    // An old scrolling-card layout must not influence new line measurements.
    this.verses.classList.remove("portrait-overflow");
    this.verses.removeAttribute("data-native-scroll");
    // Apply portrait typography before measuring wrapped hemistichs.
    this.verses.classList.toggle("portrait-reading", this.vw <= 760 && this.vh > this.vw && this.section.portraitLayout !== "immersive");
    const coverW = Math.max(this.vw, this.vh * PAINTING_ASPECT);
    this.paintW = coverW * OVERSCAN;
    this.paintH = (coverW / PAINTING_ASPECT) * OVERSCAN;

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.world.width = Math.round(this.vw * this.pixelRatio);
    this.world.height = Math.round(this.vh * this.pixelRatio);
    for (const scene of this.scenes) scene.backdrop = undefined;
    if (this.light) {
      this.light.style.width = `${this.paintW}px`;
      this.light.style.height = `${this.paintH}px`;
    }

    this.track.style.height = `${(this.timeline.total + 1) * this.vh}px`;
    for (const d of this.track.querySelectorAll<HTMLElement>(".detent")) d.style.top = `${Number(d.dataset.beat) * this.vh}px`;
    this.dust?.resize();
    // Fit one stable panel to the tallest couplet in each scene. Its size
    // stays fixed while that scene's words change, including wrapped lines.
    const style = getComputedStyle(this.bed);
    const font = parseFloat(getComputedStyle(this.couplets[0]?.root.querySelector(".hemistich") ?? this.bed).fontSize);
    const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.8;
    const padding = parseFloat(style.getPropertyValue("--reading-padding")) || 24;
    const extents = this.section.scenes.map(scene => [0, 1].map(side => Math.max(0, ...scene.couplets.map(number => {
      const half = this.couplets[number - 1].root.querySelectorAll<HTMLElement>(".hemistich")[side];
      return half.offsetHeight - font / 2 + gap / 2;
    }))));
    this.readingHeights = extents.map(([above, below]) => above + below + padding * 2);
    const top = this.hud.getBoundingClientRect().bottom + 20;
    const bottom = this.previousButton.parentElement!.getBoundingClientRect().top - 20;
    this.portraitLayouts = extents.map(([above, below]) => computePortraitLayout({
      width: this.vw, height: this.vh, hudBottom: top - 20, controlsTop: bottom + 20,
      above, below, padding, mode: this.section.portraitLayout,
    }));
    this.readingCenters = extents.map(([above, below], i) => {
      const portrait = this.portraitLayouts[i];
      return portrait?.fits ? portrait.readingAnchor : clamp(this.vh * .6, top + above + padding, bottom - below - padding);
    });
    this.readingPanelCenters = extents.map(([above, below], i) => this.readingCenters[i] + (below - above) / 2);
    this.lastReadingScene = -1;
  }

  private targetU() {
    if (this.frozen !== null) return this.frozen;
    return clamp(window.scrollY / this.vh, 0, this.timeline.total);
  }

  // --------------------------------------------------------------- render

  private tick = (now: number) => {
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = now;

    this.detents?.tick(dt);
    const target = this.targetU();
    const prev = this.u;
    // Detents already smooths its position. A second camera easing made a
    // trackpad gesture feel delayed, and hid jumps in the old controller.
    this.u = this.reduced || !this.coarse || this.detents?.animating ? target : lerp(this.u, target, 1 - Math.exp(-dt * FOLLOW));
    if (Math.abs(target - this.u) < 0.0005) this.u = target;
    this.speed = lerp(this.speed, (this.u - prev) / dt, 1 - Math.exp(-dt * 6));

    this.render(dt, now / 1000);
    this.checkpoint();
    if (this.frozen === null) this.sound.update(this.u, this.speed);
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(dt: number, time: number) {
    const { u, timeline, vw, vh } = this;
    const entering = timeline.scenes.findIndex((span, i) => i > 0 && u >= span.diveStart && u < span.revealed);
    const started = timeline.scenes.reduce((last, span, i) => u >= span.diveStart ? i : last, 0);
    const portalScene = entering > 0 ? entering - 1 : Math.max(0, started);
    let portal = this.portraitFocus(portalScene);
    if (entering < 0 && started > 0 && !this.reduced) {
      const span = timeline.scenes[started];
      const settle = smoothstep(span.revealed, span.revealed + 0.3, u);
      const previous = this.portraitFocus(started - 1);
      portal = [lerp(previous[0], portal[0], settle), lerp(previous[1], portal[1], settle)];
    }
    const radiusMax = Math.max(...[0, vw].flatMap(x => [0, vh].map(y => Math.hypot(x - portal[0], y - portal[1])))) + 40;
    this.stage.style.setProperty("--portal-x", `${portal[0]}px`);
    this.stage.style.setProperty("--portal-y", `${portal[1]}px`);
    const push = this.reduced ? 0 : PUSH_IN;
    // Backdrop snapshots must not sample a changing portal mask. Keep the
    // opaque reading fallback until the incoming painting is fully revealed.
    this.verses.classList.toggle("is-diving", timeline.scenes.some((span, i) =>
      i > 0 && u >= span.diveStart && u < span.revealed + 0.4));

    let current = 0;
    let rimRadius = 0;
    let rimOpacity = 0;
    let glow = 0;
    let lightT = -1;

    const ctx = this.worldContext;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    timeline.scenes.forEach((span, i) => {
      const node = this.scenes[i];
      const visible = u >= span.diveStart && u <= span.gone;
      if (u >= span.diveStart) current = i;
      if (!visible) return;

      const scene = this.section.scenes[i];
      const [fx, fy] = scene.focus ?? [0.5, 0.5];

      // The threshold painting starts at full size and pushes in from the first scroll.
      let scale = Math.exp(push * (i === 0 ? u : u - span.revealed));
      const offsetY = 0;

      // Leaving: accelerate into the painting's centre.
      const isLast = i === timeline.scenes.length - 1;
      const exitEnd = isLast ? timeline.total : span.end + BEATS.dive;
      const tx = progress(u, span.end, exitEnd);
      if (!this.reduced) scale *= 1 + (isLast ? 1.1 : 1.8) * easeInCubic(tx);

      // Slide the painting so its focus moves toward the screen centre, but
      // only as far as the current zoom allows without exposing an edge.
      // Off-centre focal points are reached gradually as the camera dives in.
      const w = this.paintW * scale;
      const h = this.paintH * scale;
      const slackX = Math.max(0, (w - vw) / 2);
      const slackY = Math.max(0, (h - vh) / 2);
      const ox = i === 0 ? 0 : clamp((0.5 - fx) * w, -slackX, slackX);
      const oy = (i === 0 ? 0 : clamp((0.5 - fy) * h, -slackY, slackY)) + offsetY;
      // Arriving: open a circular portal from the screen centre.
      let clipRadius: number | null = null;
      let opacity = 1;
      if (i > 0 && u < span.revealed) {
        const td = progress(u, span.diveStart, span.revealed);
        if (this.reduced) {
          opacity = easeInOutSine(td);
        } else {
          const r = radiusMax * (0.015 + 0.985 * td * td);
          clipRadius = r;
          rimRadius = r;
          rimOpacity = Math.sin(Math.PI * td) ** 0.6;
          glow = Math.max(glow, Math.sin(Math.PI * td) * 0.3);
          lightT = td;
        }
      }

      if (node.ready) {
        ctx.save();
        ctx.globalAlpha = opacity;
        if (clipRadius !== null) {
          ctx.beginPath();
          ctx.arc(portal[0], portal[1], clipRadius, 0, Math.PI * 2);
          ctx.clip();
        }
        const portrait = this.portraitLayouts[i];
        if (i > 0 && portrait?.fits) {
          // A soft full-bleed atmosphere surrounds the complete illustration.
          // Cache this layer so canvas blur does not run on every frame.
          ctx.drawImage(this.portraitBackdrop(node), 0, 0, vw, vh);
          ctx.globalAlpha = opacity;
          const rect = portrait.artRect;
          const zoom = this.reduced ? 1 : 1 + (isLast ? 1.1 : 1.8) * easeInCubic(tx);
          // Preserve the whole composition while reading. Only the outgoing
          // dive zooms, anchored on the actual painted light rather than a face.
          const pw = rect.width * zoom;
          const ph = rect.height * zoom;
          const settle = this.reduced ? 1 : smoothstep(span.revealed, span.revealed + 0.3, u);
          const naturalFocus = [rect.x + rect.width * fx, rect.y + rect.height * fy];
          const incomingPortal = this.portraitFocus(i - 1);
          const incomingX = (incomingPortal[0] - naturalFocus[0]) * (1 - settle);
          const incomingY = (incomingPortal[1] - naturalFocus[1]) * (1 - settle);
          ctx.drawImage(node.img, rect.x + (rect.width - pw) * fx + incomingX,
            rect.y + (rect.height - ph) * fy + incomingY, pw, ph);
        } else {
          ctx.drawImage(node.img, (vw - w) / 2 + ox, (vh - h) / 2 + oy, w, h);
        }
        ctx.restore();
      }
    });

    this.loadAround(current);
    if (current !== this.lastReadingScene) {
      this.lastReadingScene = current;
      const portrait = this.portraitLayouts[current];
      const overflow = portrait !== null && portrait !== undefined && !portrait.fits;
      this.verses.classList.toggle("portrait-overflow", overflow);
      this.verses.toggleAttribute("data-native-scroll", overflow);
      this.verses.setAttribute("aria-hidden", overflow ? "false" : "true");
      for (const couplet of this.couplets) couplet.root.tabIndex = overflow ? 0 : -1;
      if (overflow) {
        this.verses.style.setProperty("--overflow-top", `${portrait.availableTop}px`);
        this.verses.style.setProperty("--overflow-bottom", `${vh - portrait.availableBottom}px`);
      }
      this.bed.style.height = `${this.readingHeights[current] || 0}px`;
      this.verses.style.setProperty("--reading-center", `${this.readingCenters[current]}px`);
      this.verses.style.setProperty("--reading-panel-center", `${this.readingPanelCenters[current]}px`);
    }

    // Portal rim and the gold clouds the camera passes through.
    this.rim.style.opacity = rimOpacity.toFixed(3);
    if (rimOpacity > 0) {
      const d = rimRadius * 2;
      this.rim.style.width = `${d}px`;
      this.rim.style.height = `${d}px`;
      this.rim.style.transform = `translate(-50%, -50%)`;
    }
    if (this.light) {
      if (lightT >= 0) {
        const s = 0.85 + 2.8 * lightT ** 1.6;
        this.light.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
        this.light.style.opacity = (Math.sin(Math.PI * lightT) * 0.55).toFixed(3);
      } else {
        this.light.style.opacity = "0";
      }
    }

    // Threshold title fades as the reader enters.
    const t0 = progress(u, 0, BEATS.threshold);
    const titleOpacity = 1 - smoothstep(0.02, 0.38, t0);
    this.threshold.style.opacity = titleOpacity.toFixed(3);
    this.threshold.style.visibility = titleOpacity > 0.001 ? "visible" : "hidden";
    this.threshold.style.transform = `translateY(${(t0 * 6).toFixed(2)}vh) scale(${(1 + t0 * 0.25).toFixed(4)})`;
    this.thresholdShade.style.opacity = (1 - smoothstep(0.05, 0.6, t0)).toFixed(3);
    this.hint.style.opacity = (1 - smoothstep(0, 0.15, t0)).toFixed(3);
    this.hint.style.visibility = t0 < 0.15 ? "visible" : "hidden";

    // Verses. The scrim and shade belong to the scene: they rise as its first
    // couplet appears and fall as its last one leaves, never between couplets.
    let scrim = 0;
    for (const [index, span] of timeline.scenes.entries()) {
      if (!this.section.scenes[index].couplets.length) continue;
      const rise = smoothstep(span.revealed - 0.15, span.revealed + 0.35, u);
      const fall = 1 - smoothstep(span.end - 0.4, span.end + 0.1, u);
      scrim = Math.max(scrim, rise * fall);
    }
    let lastStarted = 0;
    timeline.couplets.forEach((span, i) => {
      const node = this.couplets[i].root;
      if (u >= span.start) lastStarted = span.number;
      const t = (u - span.start) / (span.end - span.start);
      const visible = t > -0.02 && t < 1.02;
      node.classList.toggle("is-visible", visible);
      if (!visible) return;
      const appear = smoothstep(0, 0.24, t);
      const leave = 1 - smoothstep(0.76, 1, t);
      const presence = appear * leave;
      if (this.reduced || this.verses.classList.contains("portrait-overflow")) {
        node.style.opacity = presence.toFixed(3);
        node.style.transform = "none";
        node.style.setProperty("--blur", "0px");
        return;
      }
      const scale =
        0.92 + 0.08 * easeOutCubic(progress(t, 0, 0.26)) + 0.025 * progress(t, 0.26, 0.76) + 0.14 * easeInCubic(progress(t, 0.76, 1));
      const blur = 7 * (1 - appear) + 5 * (1 - leave);
      node.style.opacity = presence.toFixed(3);
      node.style.transform = `scale(${scale.toFixed(4)})`;
      // Blur only the words (see .hemistich), not the whole couplet layer.
      node.style.setProperty("--blur", `${blur > 0.05 ? blur.toFixed(2) : 0}px`);
    });
    this.bed.style.opacity = scrim.toFixed(3);

    // Ending: the last painting remains beneath a quiet lapis veil.
    const te = progress(u, timeline.endingStart, timeline.total);
    const closing = smoothstep(0.08, 0.6, te);
    this.glow.style.opacity = glow.toFixed(3);
    this.endingVeil.style.opacity = closing.toFixed(3);
    const col = smoothstep(0.58, 0.88, te);
    this.colophon.style.opacity = col.toFixed(3);
    this.colophon.style.transform = `translateY(${((1 - col) * 14).toFixed(1)}px)`;
    this.colophon.classList.toggle("is-visible", col > 0.01);

    // HUD.
    const atEnd = u >= timeline.total - 0.01;
    const atStart = u < (timeline.couplets[0]?.start ?? BEATS.threshold);
    const controlState = `${lastStarted}:${atEnd}:${atStart}:${u < 0.01}`;
    if (controlState !== this.lastControls) {
      this.lastControls = controlState;
      this.hudCount.textContent = atEnd ? "پایان بخش" : lastStarted
        ? `بیت ${toPersianDigits(lastStarted)} از ${toPersianDigits(this.section.couplets.length)}` : "آغاز بخش";
      this.previousButton.disabled = u < 0.01;
      this.nextButton.disabled = atEnd && !this.next?.available;
      this.nextButton.querySelector("span")!.textContent = atEnd ? "بخش بعدی" : atStart ? "شروع خواندن" : "بعدی";
      this.nextButton.setAttribute("aria-label", atEnd ? "رفتن به بخش بعدی" : atStart ? "شروع خواندن" : "بیت بعدی");
    }
    this.bar.style.transform = `scaleX(${(u / timeline.total).toFixed(4)})`;

    this.dust?.frame(dt, this.speed, (0.55 + 0.45 * smoothstep(0, 1, u)) * (1 - closing), time, portal);
  }

  /** The portrait portal stays on the light within the fitted illustration. */
  private portraitFocus(index: number): readonly [number, number] {
    const portrait = this.portraitLayouts[index];
    if (index === 0 || !portrait?.fits) return [this.vw / 2, this.vh / 2];
    const [fx, fy] = this.section.scenes[index].focus ?? [0.5, 0.5];
    const rect = portrait.artRect;
    return [rect.x + rect.width * fx, rect.y + rect.height * fy];
  }

  private portraitBackdrop(node: SceneNode) {
    if (node.backdrop) return node.backdrop;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(this.vw / 3);
    canvas.height = Math.ceil(this.vh / 3);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(this.stage).getPropertyValue("--lajevard-1000").trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const width = Math.max(canvas.width, canvas.height * PAINTING_ASPECT) * 1.2;
    const height = width / PAINTING_ASPECT;
    ctx.filter = "blur(8px)";
    ctx.globalAlpha = 0.4;
    ctx.drawImage(node.img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    node.backdrop = canvas;
    return canvas;
  }

  /** Request paintings near the reader: the current one, one behind, two ahead. */
  private loadAround(current: number) {
    for (let i = Math.max(0, current - 1); i <= Math.min(this.scenes.length - 1, current + 2); i++) {
      const node = this.scenes[i];
      if (!node.requested) {
        node.requested = true;
        node.img.src = this.section.scenes[i].image;
      }
    }
  }
}
