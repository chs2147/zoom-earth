#!/usr/bin/env python3
"""Derive tropical cyclone tracks from Zoom Earth GFS and ICON tiles.

For each forecast hour, the cyclone centre is the minimum mean sea level
pressure within SEARCH_RADIUS_DEG of the previous centre, starting from the
agency position at the run time. The maximum 10 m wind within WIND_RADIUS_DEG
of that centre is reported alongside it. Tiles are decoded with the channel
ranges in decode_tile.py.

Usage:
    python3 model_tracks.py STORM_ID RUN OUTPUT.json
    python3 model_tracks.py champi-2026 2026-10-20T18 tracks.json

Network access to zoom.earth and tiles.zoom.earth is required.
"""

import datetime as dt
import io
import json
import math
import sys
import time
import urllib.request

from PIL import Image

from decode_tile import decoder, lat_lon

MODELS = ("gfs", "icon")
ZOOM = 3  # Highest zoom GFS serves; ICON is sampled at the same zoom.
TILE_X = (6, 7)  # 90°E to 180°E
TILE_Y = 3  # 0° to 40.9°N
SEARCH_RADIUS_DEG = 4.0
WIND_RADIUS_DEG = 3.0
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Referer": "https://zoom.earth/",
}


def fetch(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def field(model, layer, level, run, hour):
    """Decoded samples [(lat, lon, value)] for the stitched tile row."""
    decode = decoder(layer)
    samples = []
    for x in TILE_X:
        url = (
            f"https://tiles.zoom.earth/{model}/v1/{layer}/webp/{level}/"
            f"{run:%Y-%m-%d/%H%M}/f{hour:03d}/{ZOOM}/{TILE_Y}/{x}.webp"
        )
        image = Image.open(io.BytesIO(fetch(url))).convert("RGBA")
        width, height = image.size
        pixels = image.load()
        for py in range(height):
            for px in range(width):
                r, g, b, a = pixels[px, py]
                if a:
                    lat, lon = lat_lon(ZOOM, x, TILE_Y, px + 0.5, py + 0.5, width, height)
                    samples.append((lat, lon, decode(r, g, b)))
        time.sleep(0.2)
    return samples


def distance_deg(lat1, lon1, lat2, lon2):
    return math.hypot(lat1 - lat2, (lon1 - lon2) * math.cos(math.radians((lat1 + lat2) / 2)))


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def track(model, run, hours, start):
    lat, lon = start
    points = []
    for hour in hours:
        pressure = field(model, "pressure", "msl", run, hour)
        near = [s for s in pressure if distance_deg(s[0], s[1], lat, lon) <= SEARCH_RADIUS_DEG]
        lat, lon, mslp = min(near, key=lambda s: s[2])
        wind = field(model, "wind-speed", "10m", run, hour)
        vmax = max(s[2] for s in wind if distance_deg(s[0], s[1], lat, lon) <= WIND_RADIUS_DEG)
        valid = run + dt.timedelta(hours=hour)
        points.append(
            {
                "hour": hour,
                "valid": f"{valid:%Y-%m-%dT%H:%MZ}",
                "lat": round(lat, 2),
                "lon": round(lon, 2),
                "mslp_hpa": round(mslp, 1),
                "max_wind_10m": round(vmax, 1),
            }
        )
        print(model, points[-1], file=sys.stderr)
    return points


def main():
    storm_id, run_text, output = sys.argv[1:4]
    run = dt.datetime.strptime(run_text, "%Y-%m-%dT%H").replace(tzinfo=dt.UTC)
    storm = json.loads(fetch(f"https://zoom.earth/data/storms/?id={storm_id}"))
    agency = {p["date"]: p for p in storm["track"]}
    start = agency[f"{run:%Y-%m-%dT%H:%M:%SZ}"]["coordinates"][::-1]

    times = {m: json.loads(fetch(f"https://tiles.zoom.earth/times/{m}.json")) for m in MODELS}
    available = [
        set(times[m]["pressure"]["msl"][str(int(run.timestamp()))])
        & set(times[m]["wind-speed"]["10m"][str(int(run.timestamp()))])
        for m in MODELS
    ]
    last = max(set.intersection(*available))
    hours = sorted({h for h in range(0, last + 1, 6)} | {last})

    result = {
        "storm": storm_id,
        "title": storm["title"],
        "agencies": storm.get("agencies"),
        "run": f"{run:%Y-%m-%dT%HZ}",
        "method": {
            "zoom": ZOOM,
            "search_radius_deg": SEARCH_RADIUS_DEG,
            "wind_radius_deg": WIND_RADIUS_DEG,
        },
        "agency_track": [
            {
                "valid": p["date"].replace(":00Z", "Z"),
                "lat": p["coordinates"][1],
                "lon": p["coordinates"][0],
                "wind_kt": p["wind"],
                "pressure_hpa": p["pressure"],
                "forecast": p["forecast"],
            }
            for p in storm["track"]
            if p["date"] >= f"{run:%Y-%m-%dT%H:%M:%SZ}"
        ],
        "models": {m: track(m, run, hours, start) for m in MODELS},
    }
    for model, points in result["models"].items():
        for point in points:
            match = agency.get(point["valid"].replace("Z", ":00Z"))
            if match:
                lon, lat = match["coordinates"]
                point["agency_distance_km"] = round(distance_km(point["lat"], point["lon"], lat, lon))
    with open(output, "w") as handle:
        json.dump(result, handle, indent=2)


if __name__ == "__main__":
    main()
