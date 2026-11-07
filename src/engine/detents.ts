import { clamp } from "./util";

/** Wheel distance (in viewport heights) that moves one beat, before resistance. */
const SENSITIVITY = 2.2;
/** Near a detent the wheel moves at (1 − HOLD) of its speed... */
const HOLD = 0.5;
/** ...falling off over this many beats either side (Gaussian width). */
const HOLD_WIDTH = 0.15;
/** A pause longer than this (ms) between wheel events starts a new gesture. */
const GESTURE_GAP = 240;
/** After the last wheel event, wait this long (ms) before settling. */
const SETTLE_DELAY = 150;
/** Critically damped spring for settling: no bounce, about 0.5s to arrive. */
const STIFFNESS = 100;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
/**
 * A released gesture carries on to the next detent once it has moved this far
 * (in beats) from where it was: the same small push works across a short gap
 * between couplets and a long dive.
 */
const COMMIT = 0.08;

/**
 * Scroll friction. Each couplet's hold, the threshold and the ending are
 * detents. Wheel and keys move a position (in beats) that
 * - slows near a detent, so a couplet holds still under a light touch;
 * - cannot pass more than one detent per gesture, so a fling or a trackpad's
 *   momentum never skips a couplet;
 * - scrubs freely between detents, so a dive can be watched slowly;
 * - settles into a detent with a critically damped spring when the gesture
 *   ends (forward if the reader was clearly heading forward).
 *
 * The position is written to window.scrollY, which stays the camera's source
 * of truth. Touch screens keep native momentum and use CSS scroll snapping
 * with scroll-snap-stop: always instead (see journey.css).
 */
export class Detents {
  private pos = 0;
  private velocity = 0;
  private target: number | null = null;
  private lastWheel = -Infinity;
  private lo = 0;
  private hi = 0;
  private direction = 0;
  private pendingSettle = false;

  constructor(
    private stops: readonly number[],
    private vh: () => number,
    private options: { wheel: boolean; reduced: boolean } = { wheel: true, reduced: false },
  ) {
    if (options.wheel) window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("touchstart", this.onTouchStart, { passive: true });
  }

  destroy() {
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("touchstart", this.onTouchStart);
    document.documentElement.classList.remove("is-stepping");
  }

  /** Something else moved the page (a jump, a resize): adopt its position. */
  sync(beat: number) {
    this.pos = beat;
    this.target = null;
    this.velocity = 0;
    this.pendingSettle = false;
    this.lastWheel = -Infinity;
    this.direction = 0;
    document.documentElement.classList.remove("is-stepping");
  }

  get animating() { return this.target !== null; }

  /** Buttons and keys share exactly the same stops as the trackpad. */
  step(direction: number) {
    if (this.target === null && !this.pendingSettle) this.pos = window.scrollY / this.vh();
    const here = this.target ?? this.pos;
    const to = direction > 0
      ? this.stops.find((s) => s > here + 0.01)
      : [...this.stops].reverse().find((s) => s < here - 0.01);
    if (to === undefined) return;
    this.travelTo(to);
  }

  private travelTo(to: number) {
    if (this.options.reduced) {
      this.sync(to);
      this.write();
      return;
    }
    this.pendingSettle = false;
    this.target = to;
    // Native touch snapping must not pull each animation frame to a stop.
    document.documentElement.classList.add("is-stepping");
  }

  /** Advance the settle spring. Call once per frame. */
  tick(dt: number) {
    if (this.pendingSettle && performance.now() - this.lastWheel > SETTLE_DELAY) {
      this.pendingSettle = false;
      this.target = this.settleTarget();
      this.velocity = 0;
    }
    if (this.target === null) {
      if (!this.pendingSettle) this.pos = window.scrollY / this.vh();
      return;
    }
    // Exact critically damped solution, stable even after a dropped frame.
    // Explicit Euler could overshoot and reverse after a 100ms frame.
    const omega = DAMPING / 2;
    const offset = this.pos - this.target;
    const momentum = this.velocity + omega * offset;
    const decay = Math.exp(-omega * dt);
    this.pos = this.target + (offset + momentum * dt) * decay;
    this.velocity = (this.velocity - omega * momentum * dt) * decay;
    if (Math.abs(this.pos - this.target) < 0.0015 && Math.abs(this.velocity) < 0.01) {
      this.pos = this.target;
      this.target = null;
      document.documentElement.classList.remove("is-stepping");
    }
    this.write();
  }

  private onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) ||
      (e.target instanceof Element && e.target.closest("[data-native-scroll]"))) return;
    e.preventDefault();
    const now = performance.now();
    const vh = this.vh();
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;
    if (px === 0) return;
    if (now - this.lastWheel > GESTURE_GAP || (Math.abs(px) > 4 && this.direction !== 0 && Math.sign(px) !== this.direction)) this.beginGesture();
    this.lastWheel = now;
    this.target = null;
    document.documentElement.classList.remove("is-stepping");
    this.velocity = 0;
    this.pendingSettle = true;

    const near = Math.min(...this.stops.map((s) => Math.abs(s - this.pos)));
    const resistance = 1 - HOLD * Math.exp(-(near * near) / (2 * HOLD_WIDTH * HOLD_WIDTH));
    const step = (px / vh) * SENSITIVITY * resistance;
    if (step !== 0) this.direction = Math.sign(step);
    this.pos = clamp(this.pos + step, this.lo, this.hi);
    this.write();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target;
    if (el instanceof Element && (el.closest("input, textarea, select, [contenteditable], [data-native-scroll]") ||
      ([" ", "Enter"].includes(e.key) && el.closest("button, a")))) return;
    if (this.target === null && !this.pendingSettle) this.pos = window.scrollY / this.vh();
    const here = this.target ?? this.pos;
    let to: number | undefined;
    if (["ArrowDown", "ArrowLeft", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey)) to = this.stops.find((s) => s > here + 0.01);
    else if (["ArrowUp", "ArrowRight", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey)) to = [...this.stops].reverse().find((s) => s < here - 0.01);
    else if (e.key === "Home") to = this.stops[0];
    else if (e.key === "End") to = this.stops[this.stops.length - 1];
    else return;
    e.preventDefault();
    if (e.repeat) return;
    if (to === undefined) return;
    if (e.key === "Home" || e.key === "End") {
      this.sync(to);
      this.write();
    } else this.travelTo(to);
  };

  private onTouchStart = () => this.sync(window.scrollY / this.vh());

  /** A gesture may travel at most to the detents either side of where it starts. */
  private beginGesture() {
    const { stops } = this;
    // Use the pending stop to choose bounds, but keep the actual position.
    // Teleporting to the pending stop here caused a flash on a quick swipe.
    const anchor = this.target ?? window.scrollY / this.vh();
    this.pos = window.scrollY / this.vh();
    const at = stops.findIndex((s) => Math.abs(s - anchor) < 0.02);
    if (at !== -1) {
      this.lo = stops[Math.max(0, at - 1)];
      this.hi = stops[Math.min(stops.length - 1, at + 1)];
    } else {
      const next = stops.findIndex((s) => s > this.pos);
      this.lo = stops[Math.max(0, next - 1)];
      this.hi = stops[next === -1 ? stops.length - 1 : next];
    }
    // A new gesture can interrupt a spring far from its pending stop.
    // Its first delta must never clamp the actual position to that stop.
    this.lo = Math.min(this.lo, this.pos);
    this.hi = Math.max(this.hi, this.pos);
    this.direction = 0;
  }

  private settleTarget() {
    const { stops, pos } = this;
    const exact = stops.find((s) => Math.abs(s - pos) < 0.002);
    if (exact !== undefined) return exact;
    const next = stops.findIndex((s) => s > pos);
    if (next <= 0) return stops[next === -1 ? stops.length - 1 : 0];
    const a = stops[next - 1];
    const b = stops[next];
    const commit = Math.min(COMMIT, 0.4 * (b - a));
    if (this.direction > 0) return pos - a > commit ? b : a;
    if (this.direction < 0) return b - pos > commit ? a : b;
    return pos - a < b - pos ? a : b;
  }

  private write() {
    window.scrollTo({ top: this.pos * this.vh(), behavior: "instant" });
  }
}
