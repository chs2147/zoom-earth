#!/usr/bin/env python3
"""Draw model and agency cyclone tracks from model_tracks.py output as SVG.

Usage:
    python3 plot_tracks.py TRACKS.json OUTPUT.svg
"""

import json
import math
import sys

WIDTH, HEIGHT = 720, 600
PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM = 48, 16, 88, 40
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = 119.5, 133.0, 16.5, 26.0

# Categorical slots 1-3 from the dataviz reference palette (validated).
SERIES = [
    ("agency", "JTWC 공식 예보", "--series-1", "#2a78d6", "#3987e5", "circle", "6 4"),
    ("gfs", "GFS", "--series-2", "#eb6834", "#d95926", "square", None),
    ("icon", "ICON", "--series-3", "#1baf7a", "#199e70", "triangle", None),
]
PLACES = [
    ("타이베이", 25.03, 121.56),
    ("이시가키", 24.34, 124.16),
    ("오키나와", 26.21, 127.68),
    ("바타네스", 20.45, 121.97),
    ("아파리", 18.36, 121.64),
]


def mercator(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def project(lat, lon):
    x = PAD_LEFT + (lon - LON_MIN) / (LON_MAX - LON_MIN) * (WIDTH - PAD_LEFT - PAD_RIGHT)
    top, bottom = mercator(LAT_MAX), mercator(LAT_MIN)
    y = PAD_TOP + (top - mercator(lat)) / (top - bottom) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
    return round(x, 1), round(y, 1)


def marker(shape, x, y, var):
    ring = 'stroke="var(--surface-1)" stroke-width="2"'
    if shape == "circle":
        return f'<circle cx="{x}" cy="{y}" r="5" fill="var({var})" {ring}/>'
    if shape == "square":
        return f'<rect x="{x - 4.5}" y="{y - 4.5}" width="9" height="9" rx="1.5" fill="var({var})" {ring}/>'
    return (
        f'<path d="M{x},{y - 6} L{x + 5.5},{y + 4} L{x - 5.5},{y + 4} Z" '
        f'fill="var({var})" stroke-linejoin="round" {ring}/>'
    )


def short_time(valid):
    return f"{int(valid[8:10])}일 {valid[11:13]}Z"


def main():
    data = json.load(open(sys.argv[1]))
    end = data["models"]["gfs"][-1]["valid"]
    tracks = {
        "agency": [
            p for p in data["agency_track"] if p["valid"] <= "2026-10-23T12:00Z"
        ],
        **data["models"],
    }
    light = "".join(f"{var}:{lv};" for _, _, var, lv, _, _, _ in SERIES)
    dark = "".join(f"{var}:{dv};" for _, _, var, _, dv, _, _ in SERIES)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" '
        f'width="{WIDTH}" height="{HEIGHT}" font-family="system-ui, -apple-system, sans-serif">',
        "<style>",
        f"svg{{--surface-1:#fcfcfb;--text-primary:#1a1a19;--text-secondary:#5f5e58;"
        f"--grid:#e6e5e0;--place:#9a998f;{light}}}",
        f"@media (prefers-color-scheme: dark){{svg{{--surface-1:#1a1a19;"
        f"--text-primary:#f0efec;--text-secondary:#c3c2b7;--grid:#33332f;--place:#7d7c74;{dark}}}}}",
        "</style>",
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="var(--surface-1)"/>',
        f'<text x="{PAD_LEFT}" y="26" font-size="17" font-weight="600" fill="var(--text-primary)">'
        f"태풍 참피 진로: GFS·ICON 모델 vs JTWC</text>",
        f'<text x="{PAD_LEFT}" y="46" font-size="12.5" fill="var(--text-secondary)">'
        f"모델 실행 {data['run'][8:10]}일 {data['run'][11:13]}Z · 모델은 +58h({short_time(end)})까지 "
        f"· 중심 = 해면기압 최저점</text>",
    ]
    # Graticule.
    for lon in range(120, 134, 2):
        x, _ = project(LAT_MIN, lon)
        out.append(f'<line x1="{x}" y1="{PAD_TOP}" x2="{x}" y2="{HEIGHT - PAD_BOTTOM}" stroke="var(--grid)" stroke-width="1"/>')
        out.append(f'<text x="{x}" y="{HEIGHT - PAD_BOTTOM + 16}" font-size="11" text-anchor="middle" fill="var(--text-secondary)">{lon}°E</text>')
    for lat in range(18, 27, 2):
        _, y = project(lat, LON_MIN)
        out.append(f'<line x1="{PAD_LEFT}" y1="{y}" x2="{WIDTH - PAD_RIGHT}" y2="{y}" stroke="var(--grid)" stroke-width="1"/>')
        out.append(f'<text x="{PAD_LEFT - 6}" y="{y + 4}" font-size="11" text-anchor="end" fill="var(--text-secondary)">{lat}°N</text>')
    # Reference places.
    for name, lat, lon in PLACES:
        x, y = project(lat, lon)
        out.append(f'<path d="M{x},{y - 4} L{x + 4},{y} L{x},{y + 4} L{x - 4},{y} Z" fill="var(--place)"/>')
        out.append(f'<text x="{x + 7}" y="{y + 4}" font-size="11" fill="var(--text-secondary)">{name}</text>')
    # Tracks: lines first, then markers on top.
    for key, _, var, _, _, _, dash in SERIES:
        points = " ".join("%s,%s" % project(p["lat"], p["lon"]) for p in tracks[key])
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        out.append(
            f'<polyline points="{points}" fill="none" stroke="var({var})" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round"{dash_attr}/>'
        )
    for key, label, var, _, _, shape, _ in SERIES:
        for p in tracks[key]:
            if key != "agency" and int(p["valid"][11:13]) % 12:
                continue
            x, y = project(p["lat"], p["lon"])
            out.append(marker(shape, x, y, var))
    # Time labels on the agency track only (selective direct labels).
    for p in tracks["agency"]:
        if p["valid"][11:13] not in ("00", "12"):
            continue
        x, y = project(p["lat"], p["lon"])
        out.append(f'<text x="{x + 9}" y="{y - 7}" font-size="11" fill="var(--text-primary)">{short_time(p["valid"])}</text>')
    # Direct labels at each model track end.
    for key, label, var, _, _, _, _ in SERIES[1:]:
        p = tracks[key][-1]
        x, y = project(p["lat"], p["lon"])
        out.append(f'<text x="{x - 10}" y="{y + 4}" font-size="12" font-weight="600" text-anchor="end" fill="var(--text-primary)">{label}</text>')
    # Legend.
    lx = PAD_LEFT
    for key, label, var, _, _, shape, dash in SERIES:
        y = 68
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        out.append(f'<line x1="{lx}" y1="{y}" x2="{lx + 22}" y2="{y}" stroke="var({var})" stroke-width="2"{dash_attr}/>')
        out.append(marker(shape, lx + 11, y, var))
        out.append(f'<text x="{lx + 28}" y="{y + 4}" font-size="12" fill="var(--text-primary)">{label}</text>')
        lx += 28 + 8 * len(label) + 40
    out.append("</svg>")
    with open(sys.argv[2], "w") as handle:
        handle.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
