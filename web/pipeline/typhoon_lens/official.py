"""Official tropical cyclone warnings from JTWC, written as official.json.

JTWC's RSS feed links each active system's JMV 3.0 data file (.tcw). A
warning file holds the forecast track with wind radii and the past track;
a formation alert (TCFA) holds only the past track. NHC's CurrentStorms.json
adds Atlantic and eastern Pacific positions that JTWC does not cover.

Usage:
    python3 -m typhoon_lens.official OUTPUT_DIR
"""

import datetime as dt
import json
import math
import os
import re
import sys
import urllib.request

JTWC_RSS = "https://www.metoc.navy.mil/jtwc/rss/jtwc.rss"
NHC_CURRENT = "https://www.nhc.noaa.gov/CurrentStorms.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (TyphoonLens personal, non-commercial)"}
NM_PER_DEG = 60.0

# Approximate track uncertainty (nautical miles) by forecast hour, used to
# draw a cone. JTWC does not publish a cone; this is not an official product.
CONE_NM = ((0, 15), (12, 25), (24, 40), (36, 55), (48, 70), (72, 100), (96, 140), (120, 185))

STORM_TYPES = (
    ("SUPER TYPHOON", "슈퍼태풍"),
    ("TYPHOON", "태풍"),
    ("HURRICANE", "허리케인"),
    ("TROPICAL STORM", "열대폭풍"),
    ("TROPICAL DEPRESSION", "열대저압부"),
    ("SUBTROPICAL STORM", "아열대폭풍"),
    ("TROPICAL CYCLONE", "사이클론"),
)


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def _coordinate(text):
    """'181N' -> 18.1, '1301E' -> 130.1, '892W' -> -89.2."""
    value = int(text[:-1]) / 10.0
    return -value if text[-1] in "SW" else value


def _iso(moment):
    return f"{moment:%Y-%m-%dT%H:%MZ}"


def _history(lines, year_prefix):
    """Past positions: 'NNYYMMDDHH LLLN LLLLE WWW', deduplicated by time."""
    seen = {}
    for line in lines:
        match = re.fullmatch(r"\d{2}(\d{8})\s+(\d+[NS])\s*(\d+[EW])\s+(\d+)\s*", line)
        if not match:
            continue
        moment = dt.datetime.strptime(year_prefix + match[1], "%Y%m%d%H").replace(tzinfo=dt.UTC)
        seen[moment] = {
            "time": _iso(moment),
            "lat": _coordinate(match[2]),
            "lon": _coordinate(match[3]),
            "wind_kt": int(match[4]),
        }
    return [seen[key] for key in sorted(seen)]


def _radii(text):
    """{'34': [ne, se, sw, nw], ...} in nautical miles."""
    radii = {}
    for kt, values in re.findall(r"R(\d{3})((?:\s+\d{3}\s+[NS][EW]\s+QD)+)", text):
        radii[str(int(kt))] = [int(v) for v in re.findall(r"(\d{3})\s+[NS][EW]\s+QD", values)]
    return radii


def parse_tcw(text, source_url):
    lines = [line.rstrip() for line in text.splitlines()]
    # The WARNING/ALERT line follows an optional WMO heading.
    start = next((i for i, line in enumerate(lines[:3]) if line.startswith(("WARNING", "ALERT"))), None)
    if start is None:
        raise ValueError(f"unrecognised JMV header: {lines[:2]!r}")
    kind = "warning" if lines[start].startswith("WARNING") else "alert"
    lines = lines[start - 1 :] if start else [""] + lines
    storm_id = os.path.basename(source_url).split(".")[0]
    storm = {"id": f"jtwc-{storm_id}", "agency": "JTWC", "kind": kind, "source": source_url}

    if kind == "warning":
        header = lines[2].split()
        base = dt.datetime.strptime(header[0], "%Y%m%d%H").replace(tzinfo=dt.UTC)
        storm.update(number=header[1], name=header[2].title(), warning=int(header[3]))
        subject = next((line for line in lines if line.startswith("SUBJ:")), "")
        storm["type"] = next((korean for english, korean in STORM_TYPES if english in subject), "열대저기압")
        forecast = []
        for line in lines[3:]:
            match = re.match(r"T(\d{3})\s+(\d+[NS])\s+(\d+[EW])\s+(\d+)(.*)", line)
            if not match:
                if forecast:
                    break
                continue
            hour = int(match[1])
            forecast.append(
                {
                    "hour": hour,
                    "time": _iso(base + dt.timedelta(hours=hour)),
                    "lat": _coordinate(match[2]),
                    "lon": _coordinate(match[3]),
                    "wind_kt": int(match[4]),
                    "radii_nm": _radii(match[5]),
                }
            )
        remarks = []
        if "AMP" in lines:
            for line in lines[lines.index("AMP") + 1 :]:
                if line.startswith("SUBJ:"):
                    break
                remarks.append(line.strip())
        storm.update(issued=_iso(base), forecast=forecast, remarks=[r for r in remarks if r])
        year_prefix = header[0][:2]
    else:
        base = dt.datetime.strptime(lines[2].strip(), "%Y%m%d%H").replace(tzinfo=dt.UTC)
        suffix = {"wp": "W", "ep": "E", "cp": "C", "sh": "S", "io": "B"}.get(storm_id[:2], "")
        storm.update(number=storm_id[2:4] + suffix, name=None, type="열대저기압 발생 경보",
                     issued=_iso(base), forecast=[], remarks=[])
        year_prefix = lines[2].strip()[:2]

    storm["history"] = _history(lines, year_prefix)
    _apply_central_pressure(storm, text)
    base_url = source_url.rsplit(".", 1)[0]
    storm["links"] = {
        "warning": base_url + "web.txt",
        "graphic": base_url + ".gif",
    }
    latest = storm["forecast"][0] if storm["forecast"] else (storm["history"][-1] if storm["history"] else None)
    if latest is None:
        raise ValueError(f"{storm_id}: no position")
    storm["position"] = {k: latest[k] for k in ("lat", "lon", "wind_kt")} | {
        "time": latest["time"],
        "pressure_hpa": latest.get("pressure_hpa"),
    }
    storm["cone"] = cone(storm["forecast"]) if len(storm["forecast"]) > 1 else None
    storm["wind_field"] = wind_field(storm["forecast"][0]) if storm["forecast"] else None
    return storm


def _apply_central_pressure(storm, text):
    """Attach 'MINIMUM CENTRAL PRESSURE AT DDHHMMZ IS NNN MB' to that fix.

    JMV files carry pressure only in this remark, for the warning time; past
    fixes and forecast points have none.
    """
    match = re.search(r"MINIMUM CENTRAL PRESSURE AT (\d{2})(\d{2})\d{2}Z IS (\d+) MB", text)
    if not match:
        return
    day, hour, pressure = int(match[1]), int(match[2]), int(match[3])
    for point in storm["history"] + storm["forecast"]:
        moment = dt.datetime.strptime(point["time"], "%Y-%m-%dT%H:%MZ")
        if moment.day == day and moment.hour == hour:
            point["pressure_hpa"] = pressure


def _cone_radius_nm(hour):
    for (h0, r0), (h1, r1) in zip(CONE_NM, CONE_NM[1:]):
        if hour <= h1:
            return r0 + (r1 - r0) * (hour - h0) / (h1 - h0)
    return CONE_NM[-1][1]


def _unwrapped(points):
    lons = []
    for point in points:
        lon = point["lon"]
        if lons:
            lon += round((lons[-1] - lon) / 360.0) * 360.0
        lons.append(lon)
    return lons


def cone(forecast):
    """Envelope of uncertainty circles along the forecast track, [[lon, lat]]."""
    lons = _unwrapped(forecast)
    lat0 = math.radians(sum(p["lat"] for p in forecast) / len(forecast))
    kx = math.cos(lat0)
    # Densify the track hourly in a local equirectangular plane (x = lon * cos(lat0)).
    samples = []
    for (a, la), (b, lb) in zip(zip(forecast, lons), zip(forecast[1:], lons[1:])):
        steps = max(1, b["hour"] - a["hour"])
        for i in range(steps):
            t = i / steps
            hour = a["hour"] + (b["hour"] - a["hour"]) * t
            samples.append(((la + (lb - la) * t) * kx, a["lat"] + (b["lat"] - a["lat"]) * t, _cone_radius_nm(hour) / NM_PER_DEG))
    last = forecast[-1]
    samples.append((lons[-1] * kx, last["lat"], _cone_radius_nm(last["hour"]) / NM_PER_DEG))

    left, right = [], []
    for i, (x, y, r) in enumerate(samples):
        x0, y0, _ = samples[max(0, i - 1)]
        x1, y1, _ = samples[min(len(samples) - 1, i + 1)]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        left.append((x + nx * r, y + ny * r))
        right.append((x - nx * r, y - ny * r))

    def cap(center, direction, radius):
        x, y, _ = center
        start = math.atan2(direction[1], direction[0])
        return [(x + radius * math.cos(start + math.pi / 2 - k * math.pi / 12),
                 y + radius * math.sin(start + math.pi / 2 - k * math.pi / 12)) for k in range(1, 12)]

    end_dir = (samples[-1][0] - samples[-2][0], samples[-1][1] - samples[-2][1])
    start_dir = (samples[0][0] - samples[1][0], samples[0][1] - samples[1][1])
    ring = left + cap(samples[-1], end_dir, samples[-1][2]) + right[::-1] + cap(samples[0], start_dir, samples[0][2])
    ring.append(ring[0])
    return [[round(x / kx, 3), round(y, 3)] for x, y in ring]


def wind_field(point):
    """Quadrant wind radii at the current position as rings, largest first."""
    rings = {}
    kx = math.cos(math.radians(point["lat"]))
    for kt, radii in sorted(point["radii_nm"].items(), key=lambda item: int(item[0])):
        if len(radii) != 4 or not any(radii):
            continue
        ring = []
        for quadrant, radius_nm in enumerate(radii):  # NE, SE, SW, NW clockwise from north
            for k in range(0, 10):
                bearing = math.radians(quadrant * 90 + k * 10)
                r = radius_nm / NM_PER_DEG
                ring.append([round(point["lon"] + r * math.sin(bearing) / kx, 3), round(point["lat"] + r * math.cos(bearing), 3)])
        ring.append(ring[0])
        rings[kt] = ring
    return rings or None


def jtwc_storms():
    rss = _get(JTWC_RSS)
    urls = sorted(set(re.findall(r"https://www\.metoc\.navy\.mil/jtwc/products/\w+\.tcw", rss)))
    storms, errors = [], []
    for url in urls:
        try:
            storms.append(parse_tcw(_get(url), url))
        except Exception as error:  # Keep other storms when one file is malformed.
            errors.append(f"{url}: {error}")
    return storms, errors


def nhc_storms():
    """Current NHC positions (no forecast track yet)."""
    data = json.loads(_get(NHC_CURRENT))
    storms = []
    for item in data.get("activeStorms", []):
        lat, lon = item.get("latitudeNumeric"), item.get("longitudeNumeric")
        if lat is None or lon is None:
            continue
        moment = item.get("lastUpdate")
        storms.append(
            {
                "id": f"nhc-{item.get('id')}",
                "agency": "NHC",
                "kind": "advisory",
                "source": NHC_CURRENT,
                "number": item.get("binNumber") or item.get("id"),
                "name": item.get("name"),
                "type": item.get("classification"),
                "issued": moment,
                "position": {"lat": lat, "lon": lon, "wind_kt": item.get("intensity"), "time": moment},
                "forecast": [],
                "history": [],
                "remarks": [],
                "cone": None,
                "wind_field": None,
            }
        )
    return storms


def main():
    output = sys.argv[1]
    storms, errors = jtwc_storms()
    try:
        covered = {(round(s["position"]["lat"]), round(s["position"]["lon"])) for s in storms}
        storms += [s for s in nhc_storms() if (round(s["position"]["lat"]), round(s["position"]["lon"])) not in covered]
    except Exception as error:
        errors.append(f"NHC: {error}")
    result = {
        "generated": _iso(dt.datetime.now(dt.UTC)),
        "sources": ["JTWC", "NHC"],
        "cone_note": "진로 불확실성 범위는 예보 시간별 평균 오차로 그린 근사치이며 공식 산출물이 아닙니다.",
        "storms": storms,
        "errors": errors,
    }
    path = os.path.join(output, "official.json")
    with open(path + ".tmp", "w") as handle:
        json.dump(result, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(path + ".tmp", path)
    for storm in storms:
        print(f"{storm['agency']} {storm['number']} {storm.get('name')} {storm['type']} "
              f"{len(storm['forecast'])} forecast / {len(storm['history'])} history", file=sys.stderr)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)


if __name__ == "__main__":
    main()
