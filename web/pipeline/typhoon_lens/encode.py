"""Pack physical fields into lossless WebP frames.

Encodings (all RGB, 8 bits per channel, decoded by the web app's shaders):

- scalar16: value -> 16-bit code over [min, max]; R = high byte, G = low byte.
- uv12: u and v -> 12-bit codes over [min, max]; R = u >> 4, G = v >> 4,
  B = (u & 15) << 4 | (v & 15).
- precip: rate -> 16-bit code in R/G over [min, max]; B = cloud cover
  (0..100% -> 0..127) plus 128 when the categorical snow flag is set.

Lossless WebP keeps every code exact, unlike the lossy tiles some services use.
"""

import io

import numpy as np
from PIL import Image


def _code(values, low, high, bits):
    scale = (1 << bits) - 1
    return np.clip(np.rint((values - low) / (high - low) * scale), 0, scale).astype(np.uint32)


def encode(layer, arrays):
    if layer.encoding == "scalar16":
        code = _code(arrays[0], layer.min, layer.max, 16)
        rgb = np.stack([code >> 8, code & 255, np.zeros_like(code)], axis=-1)
    elif layer.encoding == "uv12":
        u = _code(arrays[0], layer.min, layer.max, 12)
        v = _code(arrays[1], layer.min, layer.max, 12)
        rgb = np.stack([u >> 4, v >> 4, ((u & 15) << 4) | (v & 15)], axis=-1)
    elif layer.encoding == "precip":
        rate, clouds, snow = arrays
        code = _code(rate, layer.min, layer.max, 16)
        cloud_code = np.clip(np.rint(clouds * 1.27), 0, 127).astype(np.uint32)
        rgb = np.stack([code >> 8, code & 255, cloud_code + np.where(snow > 0.5, 128, 0)], axis=-1)
    else:
        raise ValueError(f"unknown encoding {layer.encoding}")
    buffer = io.BytesIO()
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(buffer, "WEBP", lossless=True, quality=100, method=4)
    return buffer.getvalue()


def decode(layer, rgb):
    """Inverse of encode() for verification; returns physical arrays."""
    r, g, b = (rgb[..., i].astype(np.float64) for i in range(3))
    span = layer.max - layer.min
    if layer.encoding == "scalar16":
        return [layer.min + (r * 256 + g) / 65535 * span]
    if layer.encoding == "uv12":
        u = r * 16 + np.floor(b / 16)
        v = g * 16 + b % 16
        return [layer.min + u / 4095 * span, layer.min + v / 4095 * span]
    rate = layer.min + (r * 256 + g) / 65535 * span
    return [rate, (b % 128) / 1.27, (b >= 128).astype(np.float64)]
