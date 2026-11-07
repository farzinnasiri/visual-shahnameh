/**
 * Gold dust floating in the space between the camera and the painting.
 * Particles drift toward the camera slowly at rest and stream past when the
 * reader scrolls, which is what makes scrolling feel like moving forward.
 */
interface Mote {
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
}

export class Dust {
  private ctx: CanvasRenderingContext2D;
  private motes: Mote[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const count = Math.round(Math.min(160, (this.w * this.h) / 9000));
    this.motes = Array.from({ length: count }, () => this.spawn(Math.random()));
  }

  private spawn(z: number): Mote {
    // Keep the very centre clear so motes don't sit on the verses' focal point.
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.25 + Math.random() * 1.1;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.75,
      z,
      size: 0.6 + Math.random() * 1.6,
      twinkle: Math.random() * Math.PI * 2,
    };
  }

  /**
   * @param dt seconds since last frame
   * @param speed camera speed in beats per second (signed)
   * @param intensity 0..1 overall visibility
   */
  frame(dt: number, speed: number, intensity: number, time: number, origin?: readonly [number, number]) {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (intensity <= 0.01) return;

    const travel = (0.035 + Math.max(-2.5, Math.min(2.5, speed)) * 0.42) * dt;
    const focal = Math.min(w, h) * 0.55;
    const [cx, cy] = origin ?? [w / 2, h / 2];
    ctx.globalCompositeOperation = "lighter";

    for (const m of this.motes) {
      m.z -= travel;
      if (m.z < 0.04) Object.assign(m, this.spawn(1));
      else if (m.z > 1) Object.assign(m, this.spawn(0.05));

      const sx = cx + (m.x / m.z) * focal;
      const sy = cy + (m.y / m.z) * focal;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

      const near = Math.min(1, (1 - m.z) * 1.6);
      const fadeIn = Math.min(1, (1 - m.z) * 4);
      const tw = 0.65 + 0.35 * Math.sin(time * 1.7 + m.twinkle);
      const alpha = near * fadeIn * tw * intensity * 0.75;
      const r = (m.size / m.z) * 0.55;

      // Streak along the direction of travel when moving fast.
      const streak = Math.min(18, Math.abs(speed) * 6 / m.z);
      const dx = sx - cx;
      const dy = sy - cy;
      const len = Math.hypot(dx, dy) || 1;

      ctx.strokeStyle = `rgba(243, 214, 140, ${alpha})`;
      ctx.lineWidth = Math.max(0.6, r);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (dx / len) * streak * Math.sign(speed || 1), sy - (dy / len) * streak * Math.sign(speed || 1));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
