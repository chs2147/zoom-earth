// Display units and value formatting. Physical values stay in layer units
// (wind m/s); conversion happens only here, at display time.

import type { LayerInfo } from "./data";
import { SCALES } from "./palettes";

export type WindUnit = "kmh" | "ms" | "kt";

const WIND_UNITS: Record<WindUnit, { label: string; perMs: number }> = {
  kmh: { label: "km/h", perMs: 3.6 },
  ms: { label: "m/s", perMs: 1 },
  kt: { label: "kt", perMs: 1.943844 },
};

export interface Settings {
  windUnit: WindUnit;
  windAnimation: boolean;
}

const STORAGE_KEY = "typhoon-lens-settings";

export function loadSettings(): Settings {
  const defaults: Settings = { windUnit: "kmh", windAnimation: true };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
    return {
      windUnit: stored.windUnit && stored.windUnit in WIND_UNITS ? stored.windUnit : defaults.windUnit,
      windAnimation: typeof stored.windAnimation === "boolean" ? stored.windAnimation : defaults.windAnimation,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings last for this visit only.
  }
}

const isWind = (layerId: string) => layerId === "wind" || layerId === "gust";

export function windLabel(settings: Settings): string {
  return WIND_UNITS[settings.windUnit].label;
}

export function windFromMs(ms: number, settings: Settings): number {
  return ms * WIND_UNITS[settings.windUnit].perMs;
}

export function windFromKt(kt: number, settings: Settings): number {
  return (kt / 1.943844) * WIND_UNITS[settings.windUnit].perMs;
}

export function unitLabel(layer: LayerInfo, settings: Settings): string {
  return isWind(layer.id) ? windLabel(settings) : layer.unit;
}

// Legend ticks in display units with their physical (layer-unit) values.
export function legendTicks(layerId: string, settings: Settings): { label: string; value: number }[] {
  const scale = SCALES[layerId];
  if (!isWind(layerId)) return scale.ticks.map((v) => ({ label: String(v), value: v }));
  const perMs = WIND_UNITS[settings.windUnit].perMs;
  const max = scale.domain[1] * perMs;
  const step = [5, 10, 20, 25, 30, 40, 50].find((s) => max / s <= 6) ?? 50;
  const ticks = [];
  for (let v = 0; v <= max + 1e-6; v += step) ticks.push({ label: String(v), value: v / perMs });
  return ticks;
}

// Direction the wind blows toward, as an arrow.
function windArrow(u: number, v: number): string {
  const bearing = (Math.atan2(u, v) * 180) / Math.PI;
  return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][Math.round(((bearing + 360) % 360) / 45) % 8];
}

// Full readout for the value probe.
export function formatValue(layer: LayerInfo, values: number[], settings: Settings): string {
  if (layer.id === "wind") {
    const [u, v] = values;
    const from = (Math.atan2(-u, -v) * 180) / Math.PI;
    const names = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    const direction = names[Math.round(((from + 360) % 360) / 45) % 8];
    return `바람 ${windFromMs(Math.hypot(u, v), settings).toFixed(0)} ${windLabel(settings)} · ${direction}풍`;
  }
  if (layer.id === "gust") return `돌풍 ${windFromMs(values[0], settings).toFixed(0)} ${windLabel(settings)}`;
  if (layer.id === "precipitation") {
    const [rate, clouds, snow] = values;
    if (rate < 0.05) return `강수 없음 · 구름 ${Math.round(clouds)}%`;
    return `${snow > 0.5 ? "눈" : "비"} ${rate.toFixed(1)} mm/h`;
  }
  const digits = layer.id === "pressure" ? 0 : 1;
  return `${layer.title} ${values[0].toFixed(digits)} ${layer.unit}`;
}

// Compact label for city markers ("23 ↘", "15°", "1013").
export function shortValue(layer: LayerInfo, values: number[], settings: Settings): string {
  switch (layer.id) {
    case "wind": {
      const [u, v] = values;
      return `${Math.round(windFromMs(Math.hypot(u, v), settings))} ${windArrow(u, v)}`;
    }
    case "gust":
      return String(Math.round(windFromMs(values[0], settings)));
    case "temperature":
      return `${Math.round(values[0])}°`;
    case "humidity":
      return `${Math.round(values[0])}%`;
    case "pressure":
      return String(Math.round(values[0]));
    case "precipitation":
      return values[0] < 0.05 ? "" : values[0] < 10 ? values[0].toFixed(1) : String(Math.round(values[0]));
    default:
      return values[0].toFixed(0);
  }
}
