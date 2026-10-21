"""Choose working observation overlays and write overlays.json.

The web app loads satellite imagery and fire detections straight from NASA
GIBS in the viewer's browser. Satellites are retired and daily composites
appear hours after the day ends, so a fixed layer and date can silently show
nothing. This probes candidate layers and dates with a real tile request and
publishes the first that returns imagery. RainViewer radar timestamps change
every few minutes, so the app still fetches those itself; this only records
whether the API answered.

Usage:
    python3 -m typhoon_lens.overlays OUTPUT_DIR
"""

import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
RAINVIEWER = "https://api.rainviewer.com/public/weather-maps.json"
USER_AGENT = "TyphoonLens/0.1 (personal, non-commercial)"

# Probe tile: z=2 covering East Asia (x=3, y=1).
PROBE = {"z": 2, "x": 3, "y": 1}

# (layer, satellite label), preferred first. Each is a daily composite.
TRUE_COLOR = (
    ("VIIRS_NOAA21_CorrectedReflectance_TrueColor", "NOAA-21 VIIRS"),
    ("VIIRS_NOAA20_CorrectedReflectance_TrueColor", "NOAA-20 VIIRS"),
    ("VIIRS_SNPP_CorrectedReflectance_TrueColor", "Suomi NPP VIIRS"),
    ("MODIS_Aqua_CorrectedReflectance_TrueColor", "Aqua MODIS"),
    ("MODIS_Terra_CorrectedReflectance_TrueColor", "Terra MODIS"),
)
TRUE_COLOR_MATRICES = ("GoogleMapsCompatible_Level9",)

FIRES = (
    ("VIIRS_NOAA21_Thermal_Anomalies_375m_All", "NOAA-21 VIIRS"),
    ("VIIRS_NOAA20_Thermal_Anomalies_375m_All", "NOAA-20 VIIRS"),
    ("VIIRS_SNPP_Thermal_Anomalies_375m_All", "Suomi NPP VIIRS"),
    ("MODIS_Combined_Thermal_Anomalies_All", "MODIS"),
)
# Fire layers are published at different resolutions; try both.
FIRES_MATRICES = ("GoogleMapsCompatible_Level9", "GoogleMapsCompatible_Level8")

# A daily true-colour tile of East Asia is tens of kilobytes; an empty
# (no-data) tile is a few hundred bytes.
MIN_IMAGERY_BYTES = 4000


def _get(url):
    """(status, content type, body); network errors become status 0."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as error:
        # Keep the start of the error body (an OWS exception) for the log.
        return error.code, error.headers.get("Content-Type", ""), error.read()[:300]
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"  {url}: {error}", file=sys.stderr)
        return 0, "", b""


def _template(layer, day, matrix, extension):
    return f"{GIBS}/{layer}/default/{day}/{matrix}/{{z}}/{{y}}/{{x}}.{extension}"


def _probe_url(template):
    return template.replace("{z}", str(PROBE["z"])).replace("{y}", str(PROBE["y"])).replace("{x}", str(PROBE["x"]))


def _wms_template(layer, day):
    # MapLibre fills {bbox-epsg-3857} per 256 px tile.
    return (
        f"{GIBS_WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={layer}&STYLES=&CRS=EPSG:3857"
        f"&BBOX={{bbox-epsg-3857}}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE&TIME={day}"
    )


def _probe_bbox():
    """EPSG:3857 bounds of the probe tile, as MapLibre writes {bbox-epsg-3857}."""
    extent = 20037508.342789244
    size = 2 * extent / 2 ** PROBE["z"]
    west = -extent + PROBE["x"] * size
    north = extent - PROBE["y"] * size
    return f"{west},{north - size},{west + size},{north}"


def choose_wms(candidates, accept, days, get=_get):
    """First (layer, label, day, template) whose WMS GetMap is accepted."""
    for day in days:
        for layer, label in candidates:
            template = _wms_template(layer, day)
            status, content_type, body = get(template.replace("{bbox-epsg-3857}", _probe_bbox()))
            ok = accept(status, content_type, body)
            detail = "" if ok or content_type.startswith("image/") else f" {body[:160]!r}"
            print(f"  WMS {layer} {day}: HTTP {status} {content_type} {len(body)} B -> {'ok' if ok else 'no'}{detail}", file=sys.stderr)
            if ok:
                return layer, label, day, template
    return None


def choose(candidates, matrices, extension, accept, days, get=_get):
    """First (layer, label, day, template, maxzoom) whose probe tile is accepted."""
    for day in days:
        for layer, label in candidates:
            for matrix in matrices:
                template = _template(layer, day, matrix, extension)
                status, content_type, body = get(_probe_url(template))
                ok = accept(status, content_type, body)
                detail = "" if ok or content_type.startswith("image/") else f" {body[:160]!r}"
                print(f"  {layer} {matrix} {day}: HTTP {status} {content_type} {len(body)} B -> {'ok' if ok else 'no'}{detail}", file=sys.stderr)
                if ok:
                    return layer, label, day, template, int(matrix.rsplit("Level", 1)[1])
    return None


def _imagery(status, content_type, body):
    return status == 200 and content_type.startswith("image/") and len(body) >= MIN_IMAGERY_BYTES


def _fires(status, content_type, body):
    # Fire tiles are mostly transparent; a valid PNG response is enough.
    return status == 200 and content_type.startswith("image/png")


def build(now=None, get=_get):
    now = now or dt.datetime.now(dt.UTC)
    days = [f"{(now - dt.timedelta(days=n)):%Y-%m-%d}" for n in (1, 2, 3)]
    result = {"generated": f"{now:%Y-%m-%dT%H:%MZ}"}

    print("satellite:", file=sys.stderr)
    chosen = choose(TRUE_COLOR, TRUE_COLOR_MATRICES, "jpg", _imagery, days, get)
    result["satellite"] = (
        {
            "tiles": [chosen[3]],
            "maxzoom": chosen[4],
            "date": chosen[2],
            "note": f"NASA GIBS {chosen[1]} · {chosen[2]} 합성 영상",
            "attribution": f"NASA GIBS / {chosen[1]}",
        }
        if chosen
        else None
    )

    print("fires:", file=sys.stderr)
    # GIBS serves fire detections as vector data, so pre-rendered WMTS tiles
    # may not exist; WMS renders them to PNG for any tile's bounding box.
    chosen = choose(FIRES, FIRES_MATRICES, "png", _fires, days, get)
    if chosen is None:
        wms = choose_wms(FIRES, _fires, days, get)
        chosen = (*wms, 9) if wms else None
    result["fires"] = (
        {
            "tiles": [chosen[3]],
            "maxzoom": chosen[4],
            "date": chosen[2],
            "note": f"NASA GIBS {chosen[1]} 열이상 · {chosen[2]}",
            "attribution": f"NASA FIRMS / GIBS {chosen[1]}",
        }
        if chosen
        else None
    )

    status, _, body = get(RAINVIEWER)
    radar_ok = False
    if status == 200:
        try:
            radar_ok = bool(json.loads(body)["radar"]["past"])
        except (ValueError, KeyError, TypeError):
            pass
    print(f"radar: RainViewer API HTTP {status} -> {'ok' if radar_ok else 'no'}", file=sys.stderr)
    result["radar"] = {"available": radar_ok}
    return result


def main():
    output = sys.argv[1]
    result = build()
    path = os.path.join(output, "overlays.json")
    os.makedirs(output, exist_ok=True)
    with open(path + ".tmp", "w") as handle:
        json.dump(result, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(path + ".tmp", path)


if __name__ == "__main__":
    main()
