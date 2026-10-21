// Colour scales for forecast layers. Each scale maps a physical value to a
// colour through stops; stops are interpolated in linear RGB into a 256-texel
// palette texture that the field shader samples.

export interface Scale {
  domain: [number, number];
  // [value, hex] pairs in ascending value order.
  stops: [number, string][];
  // Ticks shown under the legend bar.
  ticks: number[];
  // Optional second row (precipitation: snow).
  alternate?: [number, string][];
}

export const SCALES: Record<string, Scale> = {
  wind: {
    domain: [0, 50],
    stops: [
      [0, "#20264a"],
      [5, "#2b5f9e"],
      [10, "#2f9aa8"],
      [15, "#5cc28a"],
      [20, "#c9d65a"],
      [25, "#f2b13f"],
      [32, "#ec6c3a"],
      [40, "#c8304f"],
      [50, "#f2d9f0"],
    ],
    ticks: [0, 10, 20, 30, 40, 50],
  },
  gust: {
    domain: [0, 60],
    stops: [
      [0, "#20264a"],
      [7, "#2b5f9e"],
      [14, "#2f9aa8"],
      [20, "#5cc28a"],
      [27, "#c9d65a"],
      [33, "#f2b13f"],
      [40, "#ec6c3a"],
      [50, "#c8304f"],
      [60, "#f2d9f0"],
    ],
    ticks: [0, 15, 30, 45, 60],
  },
  pressure: {
    domain: [960, 1040],
    stops: [
      [960, "#3b1f6b"],
      [985, "#2f63b5"],
      [1005, "#7fb3d5"],
      [1013, "#c9cdd2"],
      [1022, "#e8a87c"],
      [1040, "#a33b2a"],
    ],
    ticks: [960, 980, 1000, 1020, 1040],
  },
  temperature: {
    domain: [-40, 45],
    stops: [
      [-40, "#e6d6f2"],
      [-25, "#7d4fb2"],
      [-10, "#2e5fae"],
      [0, "#8fc1e0"],
      [10, "#a8d5a0"],
      [20, "#f0d26b"],
      [30, "#e8803a"],
      [38, "#b5262f"],
      [45, "#5a0f1f"],
    ],
    ticks: [-40, -20, 0, 20, 40],
  },
  humidity: {
    domain: [0, 100],
    stops: [
      [0, "#8a5a2b"],
      [30, "#d9b98a"],
      [60, "#9fd0c4"],
      [80, "#3f9fb0"],
      [100, "#1d4f8a"],
    ],
    ticks: [0, 25, 50, 75, 100],
  },
  precipitation: {
    domain: [0, 30],
    stops: [
      [0, "#9cc7f0"],
      [1, "#4f9be0"],
      [3, "#2a6fd0"],
      [6, "#2bb07a"],
      [10, "#f0c419"],
      [20, "#e8572e"],
      [30, "#b51f6b"],
    ],
    alternate: [
      [0, "#e9e4f7"],
      [1, "#c7b8ef"],
      [3, "#9a7fe0"],
      [6, "#7350c8"],
      [10, "#5a2fa8"],
      [30, "#3c1878"],
    ],
    ticks: [0, 1, 3, 6, 10, 20, 30],
  },
};

const TEXELS = 256;

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255) ** 2.2) as [number, number, number];
}

function sample(stops: [number, string][], value: number): [number, number, number] {
  if (value <= stops[0][0]) return hexToLinear(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i];
    if (value <= v1) {
      const [v0, c0] = stops[i - 1];
      const t = (value - v0) / (v1 - v0);
      const a = hexToLinear(c0);
      const b = hexToLinear(c1);
      return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t) as [number, number, number];
    }
  }
  return hexToLinear(stops[stops.length - 1][1]);
}

// Precipitation uses a square-root axis so light rain stays visible.
export function scaleCoordinate(layer: string, value: number): number {
  const [low, high] = SCALES[layer].domain;
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return layer === "precipitation" ? Math.sqrt(t) : t;
}

function valueAt(layer: string, t: number): number {
  const [low, high] = SCALES[layer].domain;
  const linear = layer === "precipitation" ? t * t : t;
  return low + linear * (high - low);
}

// RGBA bytes, TEXELS wide and one or two rows high.
export function paletteBytes(layer: string): { data: Uint8Array; rows: number } {
  const scale = SCALES[layer];
  const rows = scale.alternate ? 2 : 1;
  const data = new Uint8Array(TEXELS * rows * 4);
  [scale.stops, scale.alternate].forEach((stops, row) => {
    if (!stops) return;
    for (let i = 0; i < TEXELS; i++) {
      const rgb = sample(stops, valueAt(layer, i / (TEXELS - 1)));
      const offset = (row * TEXELS + i) * 4;
      rgb.forEach((c, k) => (data[offset + k] = Math.round(c ** (1 / 2.2) * 255)));
      data[offset + 3] = 255;
    }
  });
  return { data, rows };
}

export function cssGradient(layer: string, alternate = false): string {
  const scale = SCALES[layer];
  const stops = alternate && scale.alternate ? scale.alternate : scale.stops;
  return `linear-gradient(to right, ${stops
    .map(([v, c]) => `${c} ${(scaleCoordinate(layer, v) * 100).toFixed(1)}%`)
    .join(", ")})`;
}
