// Animated wind streaks drawn on a canvas above the map. Particles move in
// screen space with the 10 m wind sampled from the current wind frames, so
// streak speed reads the same at every zoom level.

import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayerInfo } from "./data";
import type { Frame } from "./frames";

const PIXELS_PER_MS = 0.12; // screen pixels per frame per m/s
const MAX_AGE = 90; // frames before a particle respawns
const DENSITY = 1 / 110; // particles per CSS pixel²
const MAX_PARTICLES = 3500;

// 12-bit u and v codes of the "uv12" encoding at byte offset i.
const uAt = (p: Uint8ClampedArray, i: number) => p[i] * 16 + (p[i + 2] >> 4);
const vAt = (p: Uint8ClampedArray, i: number) => p[i + 1] * 16 + (p[i + 2] & 15);

// Bilinear u/v at a longitude/latitude from a "uv12" frame, without
// allocating (this runs for every particle on every animation frame).
function sampleUV(frame: Frame, layer: LayerInfo, lon: number, lat: number, out: Float32Array, k: number): void {
  const { width, height, pixels } = frame;
  const step = 360 / width;
  const gx = (lon + 180) / step;
  const gy = Math.min(height - 1, Math.max(0, (90 - lat) / step));
  const x0 = Math.floor(gx) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.floor(gy);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = gx - Math.floor(gx);
  const fy = gy - y0;
  // Unrolled corners: no per-sample arrays.
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  const u = uAt(pixels, i00) * w00 + uAt(pixels, i10) * w10 + uAt(pixels, i01) * w01 + uAt(pixels, i11) * w11;
  const v = vAt(pixels, i00) * w00 + vAt(pixels, i10) * w10 + vAt(pixels, i01) * w01 + vAt(pixels, i11) * w11;
  const span = (layer.max - layer.min) / 4095;
  out[k] = layer.min + u * span;
  out[k + 1] = layer.min + v * span;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latitude = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

export class WindParticles {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private age = new Uint16Array(0);
  private frames: [Frame, Frame] | null = null;
  private layer: LayerInfo | null = null;
  private ratio = 0;
  private running = false;
  private handle = 0;
  private ratioScale = 1;
  private uv = new Float32Array(4);

  constructor(private map: MapLibreMap) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "wind-particles";
    map.getContainer().appendChild(this.canvas);
    this.context = this.canvas.getContext("2d")!;
    const reset = () => this.resize();
    map.on("resize", reset);
    // Trails would smear while the map moves; clear and keep animating.
    map.on("move", () => this.clear());
    this.resize();
  }

  setWind(layer: LayerInfo | null, frames: [Frame, Frame] | null, ratio: number): void {
    this.layer = layer;
    this.frames = frames;
    this.ratio = ratio;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.running) return;
    this.running = enabled;
    this.clear();
    if (enabled) this.handle = requestAnimationFrame(() => this.tick());
    else cancelAnimationFrame(this.handle);
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.map.getContainer();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    this.ratioScale = scale;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const count = Math.min(MAX_PARTICLES, Math.round(width * height * DENSITY));
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.age = new Uint16Array(count);
    for (let i = 0; i < count; i++) this.spawn(i, true);
  }

  private spawn(i: number, randomAge = false): void {
    this.x[i] = Math.random() * this.canvas.width;
    this.y[i] = Math.random() * this.canvas.height;
    this.age[i] = randomAge ? Math.floor(Math.random() * MAX_AGE) : 0;
  }

  private clear(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private tick(): void {
    if (!this.running) return;
    this.handle = requestAnimationFrame(() => this.tick());
    const { context: ctx, frames, layer } = this;
    // Fade previous trails.
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "source-over";
    if (!frames || !layer) return;

    const scale = this.ratioScale;
    // The map never rotates or tilts, so screen x is linear in longitude and
    // screen y is linear in Mercator y.
    const bounds = this.map.getBounds();
    const west = bounds.getWest();
    const lonSpan = bounds.getEast() - west;
    const top = mercatorY(Math.min(85, bounds.getNorth()));
    const ySpan = mercatorY(Math.max(-85, bounds.getSouth())) - top;
    const { width, height } = this.canvas;
    const uv = this.uv;
    ctx.lineWidth = 1.1 * scale;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    for (let i = 0; i < this.x.length; i++) {
      if (this.age[i]++ > MAX_AGE) {
        this.spawn(i);
        continue;
      }
      const px = this.x[i];
      const py = this.y[i];
      const lat = latitude(top + (py / height) * ySpan);
      if (Math.abs(lat) > 84) {
        this.spawn(i);
        continue;
      }
      const lon = ((((west + (px / width) * lonSpan + 180) % 360) + 360) % 360) - 180;
      sampleUV(frames[0], layer, lon, lat, uv, 0);
      sampleUV(frames[1], layer, lon, lat, uv, 2);
      const u = uv[0] + (uv[2] - uv[0]) * this.ratio;
      const v = uv[1] + (uv[3] - uv[1]) * this.ratio;
      const nx = px + u * PIXELS_PER_MS * scale;
      const ny = py - v * PIXELS_PER_MS * scale;
      if (nx < 0 || ny < 0 || nx > width || ny > height) {
        this.spawn(i);
        continue;
      }
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      this.x[i] = nx;
      this.y[i] = ny;
    }
    ctx.stroke();
  }
}
