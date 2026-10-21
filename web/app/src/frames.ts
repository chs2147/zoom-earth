// Loads encoded frames once and keeps the most recent ones. A frame holds the
// decoded bitmap (uploaded to the GPU by the field layer) and its raw pixel
// bytes (read by the value inspector).

import { frameUrl, type LayerInfo, type Run } from "./data";

export interface Frame {
  key: string;
  bitmap: ImageBitmap;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

const CAPACITY = 32;

export class FrameCache {
  private entries = new Map<string, Promise<Frame>>();

  constructor(private run: Run) {}

  get(layer: string, hour: number): Promise<Frame> {
    const key = `${layer}/${hour}`;
    let entry = this.entries.get(key);
    if (entry) {
      // Refresh recency.
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry;
    }
    entry = this.load(key, frameUrl(this.run, layer, hour));
    entry.catch(() => this.entries.delete(key));
    this.entries.set(key, entry);
    while (this.entries.size > CAPACITY) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.get(oldest)?.then((frame) => frame.bitmap.close()).catch(() => {});
      this.entries.delete(oldest);
    }
    return entry;
  }

  private async load(key: string, url: string): Promise<Frame> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    // Values are encoded in the colour channels, so no colour management.
    const bitmap = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return { key, bitmap, pixels, width: bitmap.width, height: bitmap.height };
  }
}

// Decoded physical components at one texel, matching the shader's decode().
function decodeTexel(layer: LayerInfo, p: Uint8ClampedArray, i: number): number[] {
  const [r, g, b] = [p[i], p[i + 1], p[i + 2]];
  const span = layer.max - layer.min;
  if (layer.encoding === "scalar16") return [layer.min + ((r * 256 + g) / 65535) * span];
  if (layer.encoding === "uv12") {
    const u = r * 16 + (b >> 4);
    const v = g * 16 + (b & 15);
    return [layer.min + (u / 4095) * span, layer.min + (v / 4095) * span];
  }
  return [layer.min + ((r * 256 + g) / 65535) * span, (b & 127) / 1.27, b >= 128 ? 1 : 0];
}

// Bilinear sample at a longitude/latitude on the 0.5° global grid.
export function sampleFrame(frame: Frame, layer: LayerInfo, lon: number, lat: number): number[] {
  const step = 360 / frame.width;
  const gx = (((lon + 180) % 360) + 360) % 360 / step;
  const gy = Math.min(frame.height - 1, Math.max(0, (90 - lat) / step));
  const x0 = Math.floor(gx) % frame.width;
  const x1 = (x0 + 1) % frame.width;
  const y0 = Math.floor(gy);
  const y1 = Math.min(frame.height - 1, y0 + 1);
  const fx = gx - Math.floor(gx);
  const fy = gy - y0;
  const at = (x: number, y: number) => decodeTexel(layer, frame.pixels, (y * frame.width + x) * 4);
  const [a, b, c, d] = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)];
  return a.map((_, k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
}
