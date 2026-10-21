// Model cyclone tracks from storms.json: GeoJSON for the map, intensity
// classes, and the storm's interpolated position at the selected time.

import type { FeatureCollection } from "geojson";
import type { OfficialStorm, Track } from "./data";

const MS_TO_KT = 1.943844;

export interface Category {
  code: string;
  label: string;
  color: string;
}

// Saffir-Simpson classes on the 1-minute (JTWC/NHC) or model maximum wind.
const CATEGORIES: [number, Category][] = [
  [137, { code: "5", label: "5등급", color: "#d64fa0" }],
  [113, { code: "4", label: "4등급", color: "#e04a4a" }],
  [96, { code: "3", label: "3등급", color: "#ef7d3c" }],
  [83, { code: "2", label: "2등급", color: "#f2b13f" }],
  [64, { code: "1", label: "1등급", color: "#f0d26b" }],
  [34, { code: "TS", label: "열대폭풍", color: "#5cc28a" }],
  [0, { code: "TD", label: "열대저압부", color: "#7fb3d5" }],
];

export function category(windMs: number): Category {
  return categoryKt(windMs * MS_TO_KT);
}

export function categoryKt(kt: number): Category {
  return CATEGORIES.find(([threshold]) => kt >= threshold)![1];
}

export function knots(windMs: number): number {
  return Math.round(windMs * MS_TO_KT);
}

// Longitudes made continuous so lines do not jump across the antimeridian.
function unwrapped(points: { lon: number }[]): number[] {
  const lons: number[] = [];
  points.forEach((p, i) => {
    if (i === 0) return lons.push(p.lon);
    let lon = p.lon;
    while (lon - lons[i - 1] > 180) lon -= 360;
    while (lon - lons[i - 1] < -180) lon += 360;
    lons.push(lon);
  });
  return lons;
}

export function trackFeatures(tracks: Track[]): FeatureCollection {
  const features: FeatureCollection["features"] = [];
  tracks.forEach((track) => {
    const lons = unwrapped(track.points);
    track.points.forEach((point, i) => {
      const color = category(point.wind).color;
      if (i > 0) {
        features.push({
          type: "Feature",
          properties: { kind: "segment", color, track: track.id },
          geometry: {
            type: "LineString",
            coordinates: [
              [lons[i - 1], track.points[i - 1].lat],
              [lons[i], point.lat],
            ],
          },
        });
      }
      if (point.hour % 12 === 0) {
        features.push({
          type: "Feature",
          properties: { kind: "point", color, track: track.id },
          geometry: { type: "Point", coordinates: [lons[i], point.lat] },
        });
      }
    });
  });
  return { type: "FeatureCollection", features };
}

export interface Position {
  lat: number;
  lon: number;
  wind: number;
  mslp: number;
}

export function positionAt(track: Track, time: number): Position | null {
  const points = track.points;
  const times = points.map((p) => Date.parse(p.valid));
  if (time < times[0] || time > times[times.length - 1]) return null;
  const lons = unwrapped(points);
  for (let i = 1; i < points.length; i++) {
    if (time <= times[i]) {
      const t = (time - times[i - 1]) / (times[i] - times[i - 1] || 1);
      const a = points[i - 1];
      const b = points[i];
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lon: lons[i - 1] + (lons[i] - lons[i - 1]) * t,
        wind: a.wind + (b.wind - a.wind) * t,
        mslp: a.mslp + (b.mslp - a.mslp) * t,
      };
    }
  }
  const last = points[points.length - 1];
  return { lat: last.lat, lon: lons[lons.length - 1], wind: last.wind, mslp: last.mslp };
}

const WIND_COLORS: Record<string, string> = { "34": "#f0d26b", "50": "#ef7d3c", "64": "#e04a4a" };

// Official warnings: approximate cone, current wind radii, past and forecast track.
export function officialFeatures(storms: OfficialStorm[]): FeatureCollection {
  const features: FeatureCollection["features"] = [];
  for (const storm of storms) {
    if (storm.cone) {
      features.push({
        type: "Feature",
        properties: { kind: "cone", storm: storm.id },
        geometry: { type: "Polygon", coordinates: [storm.cone] },
      });
    }
    for (const [kt, ring] of Object.entries(storm.wind_field ?? {})) {
      features.push({
        type: "Feature",
        properties: { kind: "wind", kt: Number(kt), color: WIND_COLORS[kt] ?? "#f0d26b", storm: storm.id },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    // Past and forecast track, each segment coloured by the class at its start.
    const track = trackPoints(storm);
    const lons = unwrapped(track);
    track.forEach((p, i) => {
      if (i > 0) {
        const previous = track[i - 1];
        features.push({
          type: "Feature",
          properties: {
            kind: p.forecast ? "forecast-segment" : "history-segment",
            color: categoryKt(previous.wind_kt ?? 0).color,
            storm: storm.id,
          },
          geometry: { type: "LineString", coordinates: [[lons[i - 1], previous.lat], [lons[i], p.lat]] },
        });
      }
      features.push({
        type: "Feature",
        properties: {
          kind: p.forecast ? "forecast-point" : "history-point",
          color: categoryKt(p.wind_kt ?? 0).color,
          storm: storm.id,
        },
        geometry: { type: "Point", coordinates: [lons[i], p.lat] },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function distanceDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlon = ((lon2 - lon1 + 540) % 360) - 180;
  return Math.hypot(lat2 - lat1, dlon * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180));
}

// The official storm a model track follows: the model position at the
// warning's issue time lies within 3° of the official position.
export function matchOfficial(track: Track, storms: OfficialStorm[]): OfficialStorm | undefined {
  let best: [number, OfficialStorm] | undefined;
  for (const storm of storms) {
    const position = positionAt(track, Date.parse(storm.position.time));
    if (!position) continue;
    const distance = distanceDeg(position.lat, position.lon, storm.position.lat, storm.position.lon);
    if (distance <= 3 && (!best || distance < best[0])) best = [distance, storm];
  }
  return best?.[1];
}

// Basin term for a mature cyclone, from the JTWC/NHC file name (wp2926...).
function matureTerm(storm: OfficialStorm): [string, string | null] {
  const basin = storm.id.replace(/^(jtwc|nhc)-/, "").slice(0, 2);
  if (basin === "wp") return ["태풍", "슈퍼태풍"];
  if (basin === "ep" || basin === "cp" || basin === "al") return ["허리케인", null];
  return ["사이클론", null];
}

// Class for a wind speed, so forecast positions show the forecast class
// rather than the class at issue time.
export function officialType(storm: OfficialStorm, windKt: number | null): string {
  if (storm.kind === "alert" || windKt == null) return storm.type;
  const [mature, superTerm] = matureTerm(storm);
  if (superTerm && windKt >= 130) return superTerm;
  if (windKt >= 64) return mature;
  if (windKt >= 34) return "열대폭풍";
  return "열대저압부";
}

export function officialTitle(storm: OfficialStorm, type = storm.type): string {
  return storm.name ? `${type} ${storm.name} (${storm.number})` : `${storm.number} ${type}`;
}

// A formation alert has no forecast; keep its last fix on the map this long.
const ALERT_HOLD_MS = 12 * 3600 * 1000;

export interface OfficialPosition {
  lat: number;
  lon: number;
  wind_kt: number | null;
  forecast: boolean;
}

// Official position at a time: past track up to the warning, then the
// forecast track. Outside the covered period there is no position.
export function officialPositionAt(storm: OfficialStorm, time: number): OfficialPosition | null {
  const issued = Date.parse(storm.issued);
  const points = trackPoints(storm);
  if (points.length === 0) return null;
  const lons = unwrapped(points);
  const first = points[0];
  const last = points[points.length - 1];
  if (time < first.t) return null;
  if (time >= last.t) {
    const hold = storm.forecast.length === 0 ? ALERT_HOLD_MS : 0;
    if (time > last.t + hold) return null;
    return { lat: last.lat, lon: lons[lons.length - 1], wind_kt: last.wind_kt, forecast: last.t > issued };
  }
  const i = points.findIndex((p) => p.t > time);
  const [a, b] = [points[i - 1], points[i]];
  const f = (time - a.t) / (b.t - a.t);
  const wind = a.wind_kt != null && b.wind_kt != null ? Math.round(a.wind_kt + (b.wind_kt - a.wind_kt) * f) : a.wind_kt;
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: lons[i - 1] + (lons[i] - lons[i - 1]) * f,
    wind_kt: wind,
    forecast: time > issued,
  };
}

interface TrackPointKt {
  time: string;
  t: number;
  lat: number;
  lon: number;
  wind_kt: number | null;
  pressure_hpa: number | null;
  forecast: boolean;
}

// Past fixes before the warning, then the forecast from the warning time.
export function trackPoints(storm: OfficialStorm): TrackPointKt[] {
  const issued = Date.parse(storm.issued);
  const past = storm.history.filter((p) => storm.forecast.length === 0 || Date.parse(p.time) < issued);
  return [
    ...past.map((p) => ({ ...p, t: Date.parse(p.time), pressure_hpa: p.pressure_hpa ?? null, forecast: false })),
    ...storm.forecast.map((p) => ({
      ...p,
      t: Date.parse(p.time),
      pressure_hpa: p.pressure_hpa ?? null,
      forecast: Date.parse(p.time) > issued,
    })),
  ];
}

export interface StormRow {
  time: number;
  windKt: number | null;
  pressure: number | null;
  forecast: boolean;
}

// Table rows for the detail panel, newest first.
export function officialRows(storm: OfficialStorm): StormRow[] {
  return trackPoints(storm)
    .map((p) => ({ time: p.t, windKt: p.wind_kt, pressure: p.pressure_hpa, forecast: p.forecast }))
    .reverse();
}

export function modelRows(track: Track, runTime: number): StormRow[] {
  return track.points
    .filter((p) => p.hour % 6 === 0)
    .map((p) => ({ time: Date.parse(p.valid), windKt: p.wind * MS_TO_KT, pressure: p.mslp, forecast: Date.parse(p.valid) > runTime }))
    .reverse();
}
