"""Build Typhoon Lens forecast frames, manifest and model storm tracks.

Usage:
    python3 -m typhoon_lens.build OUTPUT_DIR [--run YYYYMMDDHH] [--step HOURS]
                                  [--max-hour HOURS] [--keep RUNS]

OUTPUT_DIR receives:
    index.json                       latest run per model
    gfs/<run>/manifest.json          grid, layer encodings and steps
    gfs/<run>/<layer>/f<hhh>.webp    encoded frames
    gfs/<run>/storms.json            model cyclone tracks
"""

import argparse
import datetime as dt
import json
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from . import gfs
from .encode import encode
from .layers import LAYERS, to_physical
from .tracker import Tracker

MODEL = "gfs"


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temporary = path + ".tmp"
    with open(temporary, "wb") as handle:
        handle.write(data)
    os.replace(temporary, path)


def _write_json(path, value):
    _write(path, json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def build(output, run, hours, keep):
    run_id = f"{run:%Y%m%d%H}"
    run_dir = os.path.join(output, MODEL, run_id)
    wanted = sorted({field for layer in LAYERS for field in layer.fields})
    tracker = Tracker()
    steps = []
    started = time.monotonic()

    with ThreadPoolExecutor(max_workers=3) as pool:
        for hour, fields in zip(hours, pool.map(lambda h: gfs.read_fields(run, h, wanted), hours)):
            valid = f"{run + dt.timedelta(hours=hour):%Y-%m-%dT%H:%MZ}"
            physical = {key: to_physical(key[0], values) for key, values in fields.items()}
            for layer in LAYERS:
                frame = encode(layer, [physical[field] for field in layer.fields])
                _write(os.path.join(run_dir, layer.id, f"f{hour:03d}.webp"), frame)
            u = physical[("UGRD", "10 m above ground")]
            v = physical[("VGRD", "10 m above ground")]
            tracker.step(hour, valid, physical[("PRMSL", "mean sea level")], np.hypot(u, v))
            steps.append({"hour": hour, "valid": valid})
            print(f"f{hour:03d} done ({time.monotonic() - started:.0f}s)", file=sys.stderr)

    _write_json(os.path.join(run_dir, "storms.json"), {"model": MODEL, "run": f"{run:%Y-%m-%dT%H:%MZ}", "tracks": tracker.tracks()})
    _write_json(
        os.path.join(run_dir, "manifest.json"),
        {
            "model": MODEL,
            "title": "NOAA GFS 0.5°",
            "attribution": "NOAA/NCEP GFS",
            "run": f"{run:%Y-%m-%dT%H:%MZ}",
            "generated": f"{dt.datetime.now(dt.UTC):%Y-%m-%dT%H:%M:%SZ}",
            "grid": {"width": 720, "height": 361, "west": -180.0, "north": 90.0, "step": 0.5},
            "frame": "{layer}/f{hour}.webp",
            "layers": [
                {
                    "id": layer.id,
                    "title": layer.title,
                    "unit": layer.unit,
                    "encoding": layer.encoding,
                    "min": layer.min,
                    "max": layer.max,
                }
                for layer in LAYERS
            ],
            "steps": steps,
        },
    )

    # Publish the run only after every frame and the manifest exist.
    index_path = os.path.join(output, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {"models": {}}
    runs = sorted(set(index["models"].get(MODEL, {}).get("runs", [])) | {run_id}, reverse=True)
    for stale in runs[keep:]:
        shutil.rmtree(os.path.join(output, MODEL, stale), ignore_errors=True)
    index["models"][MODEL] = {"latest": runs[0], "runs": runs[:keep]}
    _write_json(index_path, index)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("--run", help="YYYYMMDDHH; defaults to the latest complete run")
    parser.add_argument("--step", type=int, default=3, help="hours between frames")
    parser.add_argument("--max-hour", type=int, default=gfs.FINAL_HOUR)
    parser.add_argument("--keep", type=int, default=2, help="runs to retain")
    args = parser.parse_args()
    run = (
        dt.datetime.strptime(args.run, "%Y%m%d%H").replace(tzinfo=dt.UTC)
        if args.run
        else gfs.latest_complete_run()
    )
    hours = [h for h in gfs.forecast_hours(args.step) if h <= args.max_hour]
    print(f"GFS {run:%Y-%m-%d %HZ}: {len(hours)} steps to f{hours[-1]:03d}", file=sys.stderr)
    build(args.output, run, hours, args.keep)


if __name__ == "__main__":
    main()
