"""Recompute storms.json from a run's encoded frames, without downloading.

Usage:
    python3 -m typhoon_lens.retrack OUTPUT_DIR/gfs/<run>
"""

import json
import os
import sys

import numpy as np
from PIL import Image

from .encode import decode
from .layers import LAYERS_BY_ID
from .tracker import Tracker


def frame(run_dir, layer, hour):
    path = os.path.join(run_dir, layer.id, f"f{hour:03d}.webp")
    return decode(layer, np.asarray(Image.open(path).convert("RGB")))


def main():
    run_dir = sys.argv[1]
    manifest = json.load(open(os.path.join(run_dir, "manifest.json")))
    pressure, wind = LAYERS_BY_ID["pressure"], LAYERS_BY_ID["wind"]
    tracker = Tracker()
    for step in manifest["steps"]:
        (mslp,) = frame(run_dir, pressure, step["hour"])
        u, v = frame(run_dir, wind, step["hour"])
        tracker.step(step["hour"], step["valid"], mslp, np.hypot(u, v))
    storms = {"model": manifest["model"], "run": manifest["run"], "tracks": tracker.tracks()}
    with open(os.path.join(run_dir, "storms.json"), "w") as handle:
        json.dump(storms, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(storms['tracks'])} tracks", file=sys.stderr)


if __name__ == "__main__":
    main()
