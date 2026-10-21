"""Detect and follow tropical cyclones in a model run.

A candidate is a local mean sea level pressure minimum that is a closed low
(at least DEPTH_HPA below its surroundings). Tracks start from candidates
with tropical-storm-force wind at low latitude and continue through weaker
closed lows near the extrapolated position. This mirrors the minimum-pressure
method used in analysis/champi-2026-model-tracks.md, applied to every storm.
"""

import math

import numpy as np

GRID = 0.5  # degrees per cell
WINDOW = 6  # local-minimum half-width in cells (3°)
RING = 8  # surrounding-mean half-width in cells (4°)
WIND_RADIUS = 5  # cells (2.5°)
DEPTH_HPA = 2.0
GENESIS_MAX_LAT = 25.0
GENESIS_WIND = 17.0  # m/s, tropical storm force
CONTINUE_MAX_LAT = 45.0
MIN_DURATION_H = 24


def _shifted_extrema(field, radius, reducer):
    """Moving min/max over a square window, wrapping in longitude."""
    padded = np.pad(field, ((radius, radius), (0, 0)), mode="edge")
    result = field.copy()
    for dy in range(-radius, radius + 1):
        rows = padded[radius + dy : radius + dy + field.shape[0]]
        for dx in range(-radius, radius + 1):
            result = reducer(result, np.roll(rows, -dx, axis=1))
    return result


def _box_mean(field, radius):
    padded = np.pad(field, ((radius, radius), (0, 0)), mode="edge")
    total = np.zeros_like(field, dtype=np.float64)
    for dy in range(-radius, radius + 1):
        rows = padded[radius + dy : radius + dy + field.shape[0]]
        for dx in range(-radius, radius + 1):
            total += np.roll(rows, -dx, axis=1)
    return total / (2 * radius + 1) ** 2


def candidates(mslp, speed):
    """[(lat, lon, mslp, max_wind)] for closed lows within CONTINUE_MAX_LAT."""
    local_min = _shifted_extrema(mslp, WINDOW, np.minimum)
    depth = _box_mean(mslp, RING) - mslp
    wind_max = _shifted_extrema(speed, WIND_RADIUS, np.maximum)
    rows, cols = np.nonzero((mslp <= local_min) & (depth >= DEPTH_HPA))
    found = []
    for row, col in zip(rows, cols):
        lat = 90.0 - row * GRID
        if abs(lat) > CONTINUE_MAX_LAT:
            continue
        lon = -180.0 + col * GRID
        found.append((lat, lon, float(mslp[row, col]), float(wind_max[row, col])))
    return found


def _distance_deg(lat1, lon1, lat2, lon2):
    dlon = (lon2 - lon1 + 180) % 360 - 180
    return math.hypot(lat2 - lat1, dlon * math.cos(math.radians((lat1 + lat2) / 2)))


class Tracker:
    def __init__(self):
        self.active = []
        self.finished = []

    def step(self, hour, valid, mslp, speed):
        found = candidates(mslp, speed)
        used = set()
        still_active = []
        for track in self.active:
            last = track["points"][-1]
            dt_h = hour - last["hour"]
            if len(track["points"]) > 1:
                prev = track["points"][-2]
                rate = dt_h / max(1, last["hour"] - prev["hour"])
                lat = last["lat"] + (last["lat"] - prev["lat"]) * rate
                lon = last["lon"] + (last["lon"] - prev["lon"]) * rate
            else:
                lat, lon = last["lat"], last["lon"]
            limit = max(2.0, 0.6 * dt_h)
            best = None
            for index, (clat, clon, cp, cw) in enumerate(found):
                if index in used:
                    continue
                distance = _distance_deg(lat, lon, clat, clon)
                if distance <= limit and (best is None or distance < best[0]):
                    best = (distance, index)
            if best is None:
                self.finished.append(track)
                continue
            used.add(best[1])
            clat, clon, cp, cw = found[best[1]]
            track["points"].append(self._point(hour, valid, clat, clon, cp, cw))
            still_active.append(track)
        for index, (clat, clon, cp, cw) in enumerate(found):
            if index in used or abs(clat) > GENESIS_MAX_LAT or cw < GENESIS_WIND:
                continue
            still_active.append({"points": [self._point(hour, valid, clat, clon, cp, cw)]})
        self.active = still_active

    @staticmethod
    def _point(hour, valid, lat, lon, mslp, wind):
        return {
            "hour": hour,
            "valid": valid,
            "lat": round(lat, 2),
            "lon": round(lon, 2),
            "mslp": round(mslp, 1),
            "wind": round(wind, 1),
        }

    def tracks(self):
        result = []
        for track in self.finished + self.active:
            points = track["points"]
            duration = points[-1]["hour"] - points[0]["hour"]
            peak = max(p["wind"] for p in points)
            if duration < MIN_DURATION_H or peak < GENESIS_WIND:
                continue
            first = points[0]
            result.append(
                {
                    "id": f"{first['valid'][:13].replace('-', '').replace('T', '')}"
                    f"_{first['lat']:+.1f}_{first['lon']:+.1f}",
                    "max_wind": peak,
                    "min_mslp": min(p["mslp"] for p in points),
                    "points": points,
                }
            )
        return sorted(result, key=lambda t: t["min_mslp"])
