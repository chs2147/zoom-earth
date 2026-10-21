// Base map built from bundled Natural Earth data (world-atlas), so the map
// needs no third-party tile server. Optional overlays load in the viewer's
// browser from public NASA GIBS and RainViewer endpoints.

import type { FeatureCollection, MultiLineString } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import type { ObservationOverlays } from "./data";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export const COLORS = {
  water: "#0d1117",
  land: "#1c2129",
  coast: "#6b7480",
  border: "#454c57",
};

// Natural Earth topology loads as separate chunks so it downloads in
// parallel with the app and caches independently.
export async function baseStyle(): Promise<StyleSpecification> {
  const [{ default: land }, { default: countries }] = await Promise.all([
    import("world-atlas/land-50m.json"),
    import("world-atlas/countries-50m.json"),
  ]);
  const landTopology = land as unknown as Topology<{ land: GeometryCollection }>;
  const countryTopology = countries as unknown as Topology<{ countries: GeometryCollection }>;
  const landFeatures = feature(landTopology, landTopology.objects.land) as unknown as FeatureCollection;
  const coastlines: MultiLineString = mesh(landTopology, landTopology.objects.land);
  const borders: MultiLineString = mesh(countryTopology, countryTopology.objects.countries, (a, b) => a !== b);
  return {
    version: 8,
    sources: {
      land: { type: "geojson", data: landFeatures },
      coast: { type: "geojson", data: { type: "Feature", properties: {}, geometry: coastlines } },
      borders: { type: "geojson", data: { type: "Feature", properties: {}, geometry: borders } },
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": COLORS.water } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": COLORS.land } },
      // Overlays and the forecast field are inserted before "coast".
      { id: "coast", type: "line", source: "coast", paint: { "line-color": COLORS.coast, "line-width": 0.8 } },
      {
        id: "borders",
        type: "line",
        source: "borders",
        paint: { "line-color": COLORS.border, "line-width": 0.6, "line-dasharray": [3, 2] },
      },
    ],
  };
}

export interface Overlay {
  id: string;
  title: string;
  note: string;
  tiles: () => Promise<{ tiles: string[]; maxzoom: number; attribution: string }>;
  opacity: number;
}

// GIBS layers chosen at deploy time by pipeline/typhoon_lens/overlays.py,
// which probes for a satellite and date that actually return imagery.
let observations: ObservationOverlays | null = null;

export function configureOverlays(info: ObservationOverlays | null): void {
  observations = info;
  for (const overlay of OVERLAYS) {
    const source = info?.[overlay.id as "satellite" | "fires"];
    if (source && "note" in source) overlay.note = source.note;
    else if (info && (overlay.id === "satellite" || overlay.id === "fires") && !source) {
      overlay.note = "지금은 사용할 수 있는 영상이 없습니다";
    }
  }
}

function gibsSource(id: "satellite" | "fires") {
  return async () => {
    const source = observations?.[id];
    if (!source) {
      throw new Error(
        observations ? "배포 시점에 사용할 수 있는 영상을 찾지 못했습니다" : "관측 레이어 정보(overlays.json)가 없습니다",
      );
    }
    return { tiles: source.tiles, maxzoom: source.maxzoom, attribution: source.attribution };
  };
}

export const OVERLAYS: Overlay[] = [
  {
    id: "satellite",
    title: "위성 (트루컬러)",
    note: "NASA GIBS · 하루 합성 영상",
    opacity: 1,
    tiles: gibsSource("satellite"),
  },
  {
    id: "radar",
    title: "강수 레이더",
    note: "RainViewer · 최근 관측",
    opacity: 0.85,
    tiles: async () => {
      const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const maps = (await response.json()) as { host: string; radar: { past: { path: string }[] } };
      const latest = maps.radar.past.at(-1);
      if (!latest) throw new Error("레이더 영상이 없습니다");
      return {
        tiles: [`${maps.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`],
        maxzoom: 7,
        attribution: "RainViewer",
      };
    },
  },
  {
    id: "fires",
    title: "산불 (열점)",
    note: "NASA GIBS 열이상",
    opacity: 1,
    tiles: gibsSource("fires"),
  },
];

// Places shown as HTML labels (MapLibre text needs a glyph server).
export const PLACES: [string, number, number][] = [
  ["서울", 37.57, 126.98],
  ["부산", 35.18, 129.08],
  ["제주", 33.5, 126.53],
  ["도쿄", 35.68, 139.69],
  ["오사카", 34.69, 135.5],
  ["오키나와", 26.21, 127.68],
  ["타이베이", 25.03, 121.56],
  ["상하이", 31.23, 121.47],
  ["홍콩", 22.32, 114.17],
  ["베이징", 39.9, 116.4],
  ["마닐라", 14.6, 120.98],
  ["괌", 13.44, 144.79],
  ["하노이", 21.03, 105.85],
  ["방콕", 13.76, 100.5],
  ["싱가포르", 1.35, 103.82],
  ["뭄바이", 19.08, 72.88],
  ["시드니", -33.87, 151.21],
  ["호놀룰루", 21.31, -157.86],
  ["마이애미", 25.76, -80.19],
  ["뉴욕", 40.71, -74.0],
  ["런던", 51.51, -0.13],
];
