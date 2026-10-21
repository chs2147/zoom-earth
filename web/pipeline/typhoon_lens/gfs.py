"""Read selected GFS 0.5° fields from NOAA's public AWS bucket.

Only the GRIB messages a layer needs are downloaded, using HTTP range requests
located through each file's .idx inventory.
"""

import datetime as dt
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pygrib

BUCKET = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"
FINAL_HOUR = 384
USER_AGENT = "TyphoonLens/0.1 (personal, non-commercial)"


def _get(url, byte_range=None):
    headers = {"User-Agent": USER_AGENT}
    if byte_range:
        headers["Range"] = "bytes=%d-%s" % byte_range
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()


def file_url(run, hour):
    return f"{BUCKET}/gfs.{run:%Y%m%d}/{run:%H}/atmos/gfs.t{run:%H}z.pgrb2.0p50.f{hour:03d}"


def forecast_hours(step_hours=3):
    return list(range(0, FINAL_HOUR + 1, step_hours))


def latest_complete_run(now=None, lookback_runs=8):
    """Most recent run whose final forecast hour is published."""
    now = now or dt.datetime.now(dt.UTC)
    run = now.replace(minute=0, second=0, microsecond=0, hour=now.hour - now.hour % 6)
    for _ in range(lookback_runs):
        prefix = f"gfs.{run:%Y%m%d}/{run:%H}/atmos/gfs.t{run:%H}z.pgrb2.0p50.f{FINAL_HOUR:03d}.idx"
        listing = _get(f"{BUCKET}/?list-type=2&prefix={prefix}&max-keys=1").decode()
        if "<Key>" in listing:
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


def read_fields(run, hour, wanted):
    """{(variable, level): 2-D array} on a -180..179.5°E, 90..-90°N grid."""
    entries = {
        (variable, level): (start, end)
        for variable, level, kind, start, end in _inventory(run, hour)
        if (variable, level) in wanted and _instantaneous(kind)
    }
    missing = set(wanted) - set(entries)
    if missing:
        raise RuntimeError(f"f{hour:03d} is missing {sorted(missing)}")

    def fetch(key):
        start, end = entries[key]
        message = pygrib.fromstring(_get(file_url(run, hour), (start, "" if end is None else end)))
        values = np.asarray(message.values, dtype=np.float32)
        # GFS longitudes run 0..359.5; centre the grid on the prime meridian.
        return key, np.roll(values, values.shape[1] // 2, axis=1)

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(pool.map(fetch, wanted))
