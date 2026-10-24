// Base map built from bundled Natural Earth data (world-atlas), so the map
// needs no third-party tile server. Optional overlays load in the viewer's
// browser from public NASA GIBS and RainViewer endpoints.

import type { FeatureCollection, MultiLineString } from "geojson";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { ObservationOverlays } from "./data";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export const COLORS = {
  water: "#0d1117",
  land: "#1c2129",
  coast: "#e8ebf0",
  coastCasing: "#05070a",
  border: "#c3c8d0",
};

// Lowest line layer; overlays and the forecast field are inserted below it.
export const FIRST_LINE_LAYER = "coast-casing";

// Line width grows with zoom so outlines stay legible when zoomed in.
const width = (base: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 1, base, 6, base * 2];

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
      // A dark casing under a light line keeps coasts visible over any colour.
      {
        id: FIRST_LINE_LAYER,
        type: "line",
        source: "coast",
        paint: { "line-color": COLORS.coastCasing, "line-opacity": 0.6, "line-width": width(2.4) },
        layout: { "line-join": "round" },
      },
      {
        id: "coast",
        type: "line",
        source: "coast",
        paint: { "line-color": COLORS.coast, "line-opacity": 0.9, "line-width": width(1) },
        layout: { "line-join": "round" },
      },
      {
        id: "borders",
        type: "line",
        source: "borders",
        paint: { "line-color": COLORS.border, "line-opacity": 0.75, "line-width": width(0.8), "line-dasharray": [3, 2] },
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

// Second tier: well-known cities shown once zoomed in a little, when they do
// not overlap a label already placed. Listed in priority order.
export const PLACES_TIER2: [string, number, number][] = [
  ["파리", 48.86, 2.35],
  ["로스앤젤레스", 34.05, -118.24],
  ["두바이", 25.2, 55.27],
  ["로마", 41.9, 12.5],
  ["샌프란시스코", 37.77, -122.42],
  ["워싱턴 D.C.", 38.91, -77.04],
  ["시카고", 41.88, -87.63],
  ["카이로", 30.04, 31.24],
  ["리우데자네이루", -22.91, -43.17],
  ["모스크바", 55.76, 37.62],
  ["이스탄불", 41.01, 28.98],
  ["멜버른", -37.81, 144.96],
  ["토론토", 43.65, -79.38],
  ["멕시코시티", 19.43, -99.13],
  ["델리", 28.61, 77.21],
  ["쿠알라룸푸르", 3.14, 101.69],
  ["베를린", 52.52, 13.4],
  ["바르셀로나", 41.39, 2.17],
  ["휴스턴", 29.76, -95.37],
  ["시애틀", 47.61, -122.33],
  ["라스베이거스", 36.17, -115.14],
  ["뉴올리언스", 29.95, -90.07],
  ["브리즈번", -27.47, 153.03],
  ["퍼스", -31.95, 115.86],
  ["오클랜드", -36.85, 174.76],
  ["밴쿠버", 49.28, -123.12],
  ["부에노스아이레스", -34.6, -58.38],
  ["케이프타운", -33.92, 18.42],
  ["아테네", 37.98, 23.73],
  ["암스테르담", 52.37, 4.9],
  ["자카르타", -6.21, 106.85],
  ["호찌민", 10.82, 106.63],
  ["후쿠오카", 33.59, 130.4],
  ["삿포로", 43.06, 141.35],
  ["교토", 35.01, 135.77],
  ["인천", 37.46, 126.71],
  ["광저우", 23.13, 113.26],
  ["마카오", 22.2, 113.54],
  ["다낭", 16.05, 108.22],
  ["세부", 10.32, 123.89],
  ["양곤", 16.84, 96.17],
  ["카트만두", 27.72, 85.32],
  ["울란바토르", 47.89, 106.91],
  ["블라디보스토크", 43.12, 131.89],
  ["댈러스", 32.78, -96.8],
  ["보스턴", 42.36, -71.06],
  ["올랜도", 28.54, -81.38],
  ["샌디에이고", 32.72, -117.16],
  ["앵커리지", 61.22, -149.9],
  ["칸쿤", 21.16, -86.85],
  ["아바나", 23.11, -82.37],
  ["상파울루", -23.55, -46.63],
  ["리마", -12.05, -77.04],
  ["골드코스트", -28.02, 153.4],
  ["케언스", -16.92, 145.77],
  ["다윈", -12.46, 130.84],
  ["애들레이드", -34.93, 138.6],
  ["마라케시", 31.63, -7.99],
  ["나이로비", -1.29, 36.82],
];
