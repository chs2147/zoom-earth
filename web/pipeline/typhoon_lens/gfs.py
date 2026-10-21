"""NOAA GFS 0.5° source, read from NOAA's public AWS bucket.

Only the GRIB messages the layers need are downloaded, using HTTP range
requests located through each file's .idx inventory.
"""

import datetime as dt
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pygrib

NAME = "gfs"
TITLE = "NOAA GFS 0.5°"
ATTRIBUTION = "NOAA/NCEP GFS"
BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
FINAL_HOUR = 384
USER_AGENT = "TyphoonLens/0.1 (personal, non-commercial)"

# Layer field -> (GRIB variable, level, conversion to the field's unit).
FIELDS = {
    "u10": ("UGRD", "10 m above ground", None),
    "v10": ("VGRD", "10 m above ground", None),
    "gust": ("GUST", "surface", None),
    "mslp": ("PRMSL", "mean sea level", lambda v: v / 100.0),  # Pa -> hPa
    "t2m": ("TMP", "2 m above ground", lambda v: v - 273.15),  # K -> °C
    "rh2m": ("RH", "2 m above ground", None),
    "precip_rate": ("PRATE", "surface", lambda v: v * 3600.0),  # kg m-2 s-1 -> mm/h
    "cloud": ("TCDC", "entire atmosphere", None),
    "snow": ("CSNOW", "surface", None),
}


def _get(url, byte_range=None):
    headers = {"User-Agent": USER_AGENT}
    if byte_range:
        headers["Range"] = "bytes=%d-%s" % byte_range
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()


def file_url(run, hour):
    return f"{BUCKET}/gfs.{run:%Y%m%d}/{run:%H}/atmos/gfs.t{run:%H}z.pgrb2.0p50.f{hour:03d}"


def forecast_hours(run, step_hours=3):
    return list(range(0, FINAL_HOUR + 1, step_hours))


def _published_hours(run):
    """Forecast hours whose .idx inventory is published for a run."""
    prefix = f"gfs.{run:%Y%m%d}/{run:%H}/atmos/gfs.t{run:%H}z.pgrb2.0p50.f"
    hours, token = set(), None
    while True:
        url = f"{BUCKET}/?list-type=2&prefix={prefix}&max-keys=1000"
        if token:
            url += "&continuation-token=" + urllib.parse.quote(token)
        listing = _get(url).decode()
        hours |= {int(h) for h in re.findall(r"\.f(\d{3})\.idx</Key>", listing)}
        token = re.search(r"<NextContinuationToken>([^<]+)</NextContinuationToken>", listing)
        if not token:
            return hours
        token = token[1]


def latest_complete_run(step_hours=3, now=None, lookback_runs=8):
    """Most recent run with every needed forecast hour published.

    NOAA uploads forecast hours out of order, so the final hour alone does
    not show that a run is complete.
    """
    now = now or dt.datetime.now(dt.UTC)
    run = now.replace(minute=0, second=0, microsecond=0, hour=now.hour - now.hour % 6)
    for _ in range(lookback_runs):
        if set(forecast_hours(run, step_hours)) <= _published_hours(run):
            return run
        run -= dt.timedelta(hours=6)
    raise RuntimeError("no complete GFS run found in the lookback window")


def _inventory(run, hour):
    """[(variable, level, kind, start, end)] where end is inclusive or None."""
    rows = []
    for line in _get(file_url(run, hour) + ".idx").decode().splitlines():
        parts = line.split(":")
        rows.append((parts[3], parts[4], parts[5], int(parts[1])))
    entries = []
    for index, (variable, level, kind, start) in enumerate(rows):
        end = rows[index + 1][3] - 1 if index + 1 < len(rows) else None
        entries.append((variable, level, kind, start, end))
    return entries


def _instantaneous(kind):
    # "anl" or "N hour fcst"; averages and accumulations are skipped.
    return kind == "anl" or re.fullmatch(r"\d+ hour fcst", kind) is not None


def read_fields(run, hour):
    """{field: 2-D array} in layer units on the common 0.5° grid."""
    wanted = {(variable, level) for variable, level, _ in FIELDS.values()}
    entries = {
        (variable, level): (start, end)
        for variable, level, kind, start, end in _inventory(run, hour)
        if (variable, level) in wanted and _instantaneous(kind)
    }
    missing = wanted - set(entries)
    if missing:
        raise RuntimeError(f"GFS f{hour:03d} is missing {sorted(missing)}")

    def fetch(name):
        variable, level, convert = FIELDS[name]
        start, end = entries[(variable, level)]
        message = pygrib.fromstring(_get(file_url(run, hour), (start, "" if end is None else end)))
        values = np.asarray(message.values, dtype=np.float32)
        # GFS longitudes run 0..359.5; centre the grid on the prime meridian.
        values = np.roll(values, values.shape[1] // 2, axis=1)
        return name, convert(values) if convert else values

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(pool.map(fetch, FIELDS))
