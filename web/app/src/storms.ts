// Model cyclone tracks from storms.json: GeoJSON for the map, intensity
// classes, and the storm's interpolated position at the selected time.

import type { FeatureCollection } from "geojson";
import type { OfficialStorm, Track } from "./data";

const MS_TO_KT = 1.943844;

export interface Category {
  label: string;
  color: string;
}

// Saffir-Simpson classes on the model's 10 m maximum wind.
const CATEGORIES: [number, Category][] = [
  [137, { label: "5등급", color: "#d64fa0" }],
  [113, { label: "4등급", color: "#e04a4a" }],
  [96, { label: "3등급", color: "#ef7d3c" }],
  [83, { label: "2등급", color: "#f2b13f" }],
  [64, { label: "1등급", color: "#f0d26b" }],
  [34, { label: "열대폭풍", color: "#5cc28a" }],
  [0, { label: "열대저압부", color: "#7fb3d5" }],
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
    const history = storm.history;
    if (history.length > 1) {
      const lons = unwrapped(history);
      features.push({
        type: "Feature",
        properties: { kind: "history", storm: storm.id },
        geometry: { type: "LineString", coordinates: history.map((p, i) => [lons[i], p.lat]) },
      });
    }
    const forecast = storm.forecast;
    if (forecast.length > 1) {
      const lons = unwrapped(forecast);
      features.push({
        type: "Feature",
        properties: { kind: "forecast", storm: storm.id },
        geometry: { type: "LineString", coordinates: forecast.map((p, i) => [lons[i], p.lat]) },
      });
      forecast.forEach((p, i) =>
        features.push({
          type: "Feature",
          properties: { kind: "forecast-point", color: categoryKt(p.wind_kt ?? 0).color, storm: storm.id },
          geometry: { type: "Point", coordinates: [lons[i], p.lat] },
        }),
      );
    }
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

export function officialTitle(storm: OfficialStorm): string {
  return storm.name ? `${storm.type} ${storm.name} (${storm.number})` : `${storm.number} ${storm.type}`;
}
