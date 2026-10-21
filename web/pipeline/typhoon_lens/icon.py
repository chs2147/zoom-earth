"""DWD ICON global source, read from DWD open data.

ICON global is published only on its native icosahedral grid (about 2.9
million cells). Each run's CLAT/CLON files locate the cells; every point of
the common 0.5° grid takes the value of the cell nearest its centre, so
extremes such as a cyclone's central pressure are not averaged away.

Precipitation is published as accumulations since the run start, so the
rate is the accumulation difference over the preceding output interval.
Only the 00Z and 12Z runs reach 180 hours; 06Z and 18Z stop at 120.
"""

import bz2
import datetime as dt
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pygrib

from .layers import GRID_HEIGHT, GRID_STEP, GRID_WIDTH

NAME = "icon"
TITLE = "DWD ICON 13 km"
ATTRIBUTION = "DWD ICON"
BASE = "https://opendata.dwd.de/weather/nwp/icon/grib"
FINAL_HOUR = 180
HOURLY_UNTIL = 78  # hourly output to 78 h, then every 3 h
USER_AGENT = "TyphoonLens/0.1 (personal, non-commercial)"

_mapping_cache = {}


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=120) as response:
        return response.read()


def _url(run, variable, hour=None):
    if hour is None:
        name = f"icon_global_icosahedral_time-invariant_{run:%Y%m%d%H}_{variable.upper()}.grib2.bz2"
    else:
        name = f"icon_global_icosahedral_single-level_{run:%Y%m%d%H}_{hour:03d}_{variable.upper()}.grib2.bz2"
    return f"{BASE}/{run:%H}/{variable}/{name}"


def _read(run, variable, hour=None):
    message = pygrib.fromstring(bz2.decompress(_get(_url(run, variable, hour))))
    return np.asarray(message.values, dtype=np.float32)


def output_hours():
    return list(range(0, HOURLY_UNTIL + 1)) + list(range(HOURLY_UNTIL + 3, FINAL_HOUR + 1, 3))


def forecast_hours(run, step_hours=3):
    available = set(output_hours())
    return [h for h in range(0, FINAL_HOUR + 1, step_hours) if h in available]


def latest_complete_run():
    """Most recent 00Z or 12Z run whose final hour is published.

    DWD keeps only the latest run of each cycle hour in its directory.
    """
    best = None
    for cycle in ("00", "12"):
        listing = _get(f"{BASE}/{cycle}/pmsl/").decode()
        runs = set(re.findall(rf"single-level_(\d{{10}})_{FINAL_HOUR:03d}_PMSL", listing))
        for run in runs:
            moment = dt.datetime.strptime(run, "%Y%m%d%H").replace(tzinfo=dt.UTC)
            best = max(best, moment) if best else moment
    if best is None:
        raise RuntimeError("no complete ICON 00Z/12Z run found")
    return best


def _mapping(run):
    """Index of the nearest ICON cell for each 0.5° grid point (row-major)."""
    if run in _mapping_cache:
        return _mapping_cache[run]
    lat = _read(run, "clat").astype(np.float64)
    lon = _read(run, "clon").astype(np.float64)
    rows = np.clip(np.rint((90.0 - lat) / GRID_STEP), 0, GRID_HEIGHT - 1).astype(np.int64)
    cols = np.rint((lon + 180.0) / GRID_STEP).astype(np.int64) % GRID_WIDTH
    target = rows * GRID_WIDTH + cols
    # Distance from each cell to its target point centre, in degrees.
    dlat = lat - (90.0 - rows * GRID_STEP)
    dlon = ((lon - (-180.0 + cols * GRID_STEP) + 180.0) % 360.0) - 180.0
    distance = np.hypot(dlat, dlon * np.cos(np.radians(lat)))
    order = np.lexsort((distance, target))
    first = np.ones(order.size, dtype=bool)
    first[1:] = target[order][1:] != target[order][:-1]
    mapping = np.full(GRID_HEIGHT * GRID_WIDTH, -1, dtype=np.int64)
    mapping[target[order][first]] = order[first]
    # Near the poles a 0.5° box can be narrower than a cell; borrow the
    # nearest filled neighbour along the latitude row, then the column.
    grid = mapping.reshape(GRID_HEIGHT, GRID_WIDTH)
    for _ in range(GRID_WIDTH):
        empty = grid < 0
        if not empty.any():
            break
        for shift, axis in ((1, 1), (-1, 1), (1, 0), (-1, 0)):
            neighbour = np.roll(grid, shift, axis=axis)
            fill = empty & (neighbour >= 0)
            grid[fill] = neighbour[fill]
            empty &= ~fill
    _mapping_cache.clear()
    _mapping_cache[run] = grid.reshape(-1)
    return _mapping_cache[run]


def _previous_output(hour):
    """The output hour before `hour`; for 0 the interval 0..1 is used."""
    hours = output_hours()
    index = hours.index(hour)
    return hours[index - 1] if index else None


def read_fields(run, hour):
    """{field: 2-D array} in layer units on the common 0.5° grid."""
    mapping = _mapping(run)
    previous = _previous_output(hour)
    # Accumulations bracket the interval ending at `hour` (0 uses 0..1).
    start, end = (previous, hour) if previous is not None else (0, 1)
    requests = {
        "u_10m": hour,
        "v_10m": hour,
        # VMAX_10M is a maximum over the preceding hour and is absent at 0.
        "vmax_10m": max(hour, 1),
        "pmsl": hour,
        "t_2m": hour,
        "relhum_2m": hour,
        "clct": hour,
    }
    accumulations = ("tot_prec", "snow_gsp", "snow_con")
    jobs = [(name, h) for name, h in requests.items()]
    jobs += [(name, h) for name in accumulations for h in (start, end)]

    def fetch(job):
        name, h = job
        return job, _read(run, name, h)[mapping].reshape(GRID_HEIGHT, GRID_WIDTH)

    with ThreadPoolExecutor(max_workers=6) as pool:
        raw = dict(pool.map(fetch, jobs))

    hours = end - start
    total = np.maximum(raw[("tot_prec", end)] - raw[("tot_prec", start)], 0) / hours
    snow = sum(np.maximum(raw[(n, end)] - raw[(n, start)], 0) for n in ("snow_gsp", "snow_con")) / hours
    return {
        "u10": raw[("u_10m", hour)],
        "v10": raw[("v_10m", hour)],
        "gust": raw[("vmax_10m", max(hour, 1))],
        "mslp": raw[("pmsl", hour)] / 100.0,
        "t2m": raw[("t_2m", hour)] - 273.15,
        "rh2m": raw[("relhum_2m", hour)],
        "precip_rate": total,
        "cloud": raw[("clct", hour)],
        "snow": (snow > 0.5 * np.maximum(total, 1e-6)).astype(np.float32),
    }


if __name__ == "__main__":
    # Quick check: python3 -m typhoon_lens.icon
    run = latest_complete_run()
    fields = read_fields(run, 24)
    row, col = np.unravel_index(np.argmin(fields["mslp"]), fields["mslp"].shape)
    print(run, "min MSLP", fields["mslp"].min(), "at", 90 - row * GRID_STEP, -180 + col * GRID_STEP)
    print({k: (float(v.min()), float(v.max())) for k, v in fields.items()})
