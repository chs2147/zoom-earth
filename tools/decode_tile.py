#!/usr/bin/env python3
"""Decode a Zoom Earth forecast-model WebP tile into physical values.

The channel ranges mirror the per-layer ranges observed in the Zoom Earth
bundle (app.43ddb4ba.js, `Sr[...] = [new ze(min, max), ...]`). See
analysis/zoom-earth-typhoon-models.md for the evidence and limitations.

Usage:
    python3 decode_tile.py LAYER Z X Y TILE.webp

LAYER is one of: pressure, wind-speed, wind-gusts, temperature,
temperature-feel, temperature-wet-bulb, humidity, dew-point.
Prints the minimum and maximum decoded value with its latitude/longitude.
"""

import math
import sys

from PIL import Image

# (min, max) per channel, in the order R, G, B.
RANGES = {
    "pressure": [(859.5, 987), (985, 1036), (1034, 1085)],  # hPa
    "wind-speed": [(-63.5, 64), (-63.5, 64)],  # u, v vector components
    "wind-gusts": [(0, 63.75)],
    "temperature": [(-89, -38), (-40, 11), (9, 60)],
    "temperature-feel": [(-89, -38), (-40, 11), (9, 60)],
    "temperature-wet-bulb": [(-64, 38)],
    "humidity": [(0, 102)],
    "dew-point": [(-95, -10), (-12, 13.5), (11.5, 37)],
}


def decoder(layer):
    ranges = RANGES[layer]
    spans = [hi - lo for lo, hi in ranges]
    if layer == "wind-speed":
        # UV shader: length of the (u, v) vector decoded from R and G.
        def decode(r, g, b):
            u = ranges[0][0] + r / 255 * spans[0]
            v = ranges[1][0] + g / 255 * spans[1]
            return math.hypot(u, v)

        return decode
    if len(ranges) == 1:
        # SCALAR shader: one channel.
        return lambda r, g, b: ranges[0][0] + r / 255 * spans[0]
    # RGB/PRESSURE shader: three overlapping piecewise channels.
    overlap = [
        (ranges[0][1] - ranges[1][0]) / spans[1],
        (ranges[1][1] - ranges[2][0]) / spans[2],
    ]

    def decode(r, g, b):
        return (
            ranges[0][0]
            + r / 255 * spans[0]
            + max(0, g / 255 - overlap[0]) * spans[1]
            + max(0, b / 255 - overlap[1]) * spans[2]
        )

    return decode


def lat_lon(z, x, y, px, py, width, height):
    n = 2**z
    lon = (x + px / width) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / height) / n))))
    return lat, lon


def main():
    layer, z, x, y, path = sys.argv[1], *map(int, sys.argv[2:5]), sys.argv[5]
    decode = decoder(layer)
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    low = high = None
    for py in range(height):
        for px in range(width):
            r, g, b, a = image.getpixel((px, py))
            if a == 0:
                continue
            value = decode(r, g, b)
            if low is None or value < low[0]:
                low = (value, px, py)
            if high is None or value > high[0]:
                high = (value, px, py)
    for label, (value, px, py) in (("min", low), ("max", high)):
        lat, lon = lat_lon(z, x, y, px, py, width, height)
        print(f"{label} {value:.1f} at lat {lat:.2f}, lon {lon:.2f}")


if __name__ == "__main__":
    main()
