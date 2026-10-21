// Types and loaders for the files written by web/pipeline/typhoon_lens/build.py.

export type Encoding = "scalar16" | "uv12" | "precip";

export interface LayerInfo {
  id: string;
  title: string;
  unit: string;
  encoding: Encoding;
  min: number;
  max: number;
}

export interface Step {
  hour: number;
  valid: string;
}

export interface Manifest {
  model: string;
  title: string;
  attribution: string;
  run: string;
  generated: string;
  grid: { width: number; height: number; west: number; north: number; step: number };
  frame: string;
  layers: LayerInfo[];
  steps: Step[];
}

export interface TrackPoint {
  hour: number;
  valid: string;
  lat: number;
  lon: number;
  mslp: number;
  wind: number;
}

export interface Track {
  id: string;
  max_wind: number;
  min_mslp: number;
  points: TrackPoint[];
}

export interface Storms {
  model: string;
  run: string;
  tracks: Track[];
}

export interface Run {
  base: string;
  manifest: Manifest;
  storms: Storms;
}

const DATA_URL: string = import.meta.env.VITE_DATA_URL ?? "./data/";

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function loadLatestRun(model = "gfs"): Promise<Run> {
  const index = await json<{ models: Record<string, { latest: string }> }>(`${DATA_URL}index.json`);
  const latest = index.models[model]?.latest;
  if (!latest) throw new Error(`no ${model} run published`);
  const base = `${DATA_URL}${model}/${latest}/`;
  const [manifest, storms] = await Promise.all([
    json<Manifest>(`${base}manifest.json`),
    json<Storms>(`${base}storms.json`),
  ]);
  return { base, manifest, storms };
}

export function frameUrl(run: Run, layer: string, hour: number): string {
  return run.base + run.manifest.frame.replace("{layer}", layer).replace("{hour}", String(hour).padStart(3, "0"));
}
