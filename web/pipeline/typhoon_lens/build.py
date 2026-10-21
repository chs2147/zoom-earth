"""Build Typhoon Lens forecast frames, manifest and model storm tracks.

Usage:
    python3 -m typhoon_lens.build OUTPUT_DIR [--model gfs|icon] [--run YYYYMMDDHH]
                                  [--step HOURS] [--max-hour HOURS] [--keep RUNS]
    python3 -m typhoon_lens.build OUTPUT_DIR --index-only

OUTPUT_DIR receives:
    index.json                         latest run per model (rebuilt from disk)
    <model>/<run>/manifest.json        grid, layer encodings and steps
    <model>/<run>/<layer>/f<hhh>.webp  encoded frames
    <model>/<run>/storms.json          model cyclone tracks
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

from . import gfs, icon
from .encode import encode
from .layers import GRID_HEIGHT, GRID_STEP, GRID_WIDTH, LAYERS
from .tracker import Tracker

SOURCES = {source.NAME: source for source in (gfs, icon)}


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temporary = path + ".tmp"
    with open(temporary, "wb") as handle:
        handle.write(data)
    os.replace(temporary, path)


def _write_json(path, value):
    _write(path, json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def write_index(output):
    """index.json from the runs on disk that have a manifest (newest first)."""
    models = {}
    for name in SOURCES:
        model_dir = os.path.join(output, name)
        if not os.path.isdir(model_dir):
            continue
        runs = sorted(
            (run for run in os.listdir(model_dir) if os.path.exists(os.path.join(model_dir, run, "manifest.json"))),
            reverse=True,
        )
        if runs:
            models[name] = {"latest": runs[0], "runs": runs}
    _write_json(os.path.join(output, "index.json"), {"models": models})


def build(output, source, run, hours, keep):
    run_id = f"{run:%Y%m%d%H}"
    model_dir = os.path.join(output, source.NAME)
    run_dir = os.path.join(model_dir, run_id)
    tracker = Tracker()
    steps = []
    started = time.monotonic()

    with ThreadPoolExecutor(max_workers=3) as pool:
        for hour, fields in zip(hours, pool.map(lambda h: source.read_fields(run, h), hours)):
            valid = f"{run + dt.timedelta(hours=hour):%Y-%m-%dT%H:%MZ}"
            for layer in LAYERS:
                frame = encode(layer, [fields[name] for name in layer.fields])
                _write(os.path.join(run_dir, layer.id, f"f{hour:03d}.webp"), frame)
            tracker.step(hour, valid, fields["mslp"], np.hypot(fields["u10"], fields["v10"]))
            steps.append({"hour": hour, "valid": valid})
            print(f"{source.NAME} f{hour:03d} done ({time.monotonic() - started:.0f}s)", file=sys.stderr)

    _write_json(
        os.path.join(run_dir, "storms.json"),
        {"model": source.NAME, "run": f"{run:%Y-%m-%dT%H:%MZ}", "tracks": tracker.tracks()},
    )
    # The manifest marks the run complete; write it after every frame.
    _write_json(
        os.path.join(run_dir, "manifest.json"),
        {
            "model": source.NAME,
            "title": source.TITLE,
            "attribution": source.ATTRIBUTION,
            "run": f"{run:%Y-%m-%dT%H:%MZ}",
            "generated": f"{dt.datetime.now(dt.UTC):%Y-%m-%dT%H:%M:%SZ}",
            "grid": {"width": GRID_WIDTH, "height": GRID_HEIGHT, "west": -180.0, "north": 90.0, "step": GRID_STEP},
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

    runs = sorted((r for r in os.listdir(model_dir) if r.isdigit()), reverse=True)
    for stale in runs[keep:]:
        shutil.rmtree(os.path.join(model_dir, stale), ignore_errors=True)
    write_index(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("--model", choices=sorted(SOURCES), default="gfs")
    parser.add_argument("--run", help="YYYYMMDDHH; defaults to the latest complete run")
    parser.add_argument("--step", type=int, default=3, help="hours between frames")
    parser.add_argument("--max-hour", type=int)
    parser.add_argument("--keep", type=int, default=2, help="runs to retain per model")
    parser.add_argument("--latest", action="store_true", help="print the latest complete run and exit")
    parser.add_argument("--index-only", action="store_true", help="rebuild index.json and exit")
    args = parser.parse_args()
    if args.index_only:
        write_index(args.output)
        return
    source = SOURCES[args.model]
    run = (
        dt.datetime.strptime(args.run, "%Y%m%d%H").replace(tzinfo=dt.UTC)
        if args.run
        else source.latest_complete_run(args.step)
    )
    if args.latest:
        print(f"{run:%Y%m%d%H}")
        return
    hours = [h for h in source.forecast_hours(run, args.step) if args.max_hour is None or h <= args.max_hour]
    print(f"{source.NAME} {run:%Y-%m-%d %HZ}: {len(hours)} steps to f{hours[-1]:03d}", file=sys.stderr)
    build(args.output, source, run, hours, args.keep)


if __name__ == "__main__":
    main()
