"""Forecast layer definitions shared by every model source and the encoder.

Layers name model-independent fields. Each source (gfs.py, icon.py) reads
its own GRIB variables and returns these fields in physical units on the
common 0.5° grid (-180..179.5°E, 90..-90°N), so layer definitions never
depend on a model's variable names.

Fields:
    u10, v10       10 m wind components (m/s)
    gust           surface wind gust (m/s)
    mslp           mean sea level pressure (hPa)
    t2m            2 m temperature (°C)
    rh2m           2 m relative humidity (%)
    precip_rate    precipitation rate (mm/h)
    cloud          total cloud cover (%)
    snow           1 where precipitation falls as snow, else 0

The manifest written by build.py publishes the same encodings and ranges, so
the web app reads them from data rather than repeating them.
"""

from dataclasses import dataclass

FIELDS = ("u10", "v10", "gust", "mslp", "t2m", "rh2m", "precip_rate", "cloud", "snow")

GRID_WIDTH = 720
GRID_HEIGHT = 361
GRID_STEP = 0.5


@dataclass(frozen=True)
class Layer:
    id: str
    title: str
    unit: str
    fields: tuple  # field names, in decode order
    encoding: str  # "scalar16", "uv12" or "precip"
    min: float
    max: float


LAYERS = (
    Layer("wind", "바람", "m/s", ("u10", "v10"), "uv12", -80, 80),
    Layer("gust", "돌풍", "m/s", ("gust",), "scalar16", 0, 100),
    Layer("pressure", "기압", "hPa", ("mslp",), "scalar16", 870, 1090),
    Layer("temperature", "기온", "°C", ("t2m",), "scalar16", -80, 60),
    Layer("humidity", "습도", "%", ("rh2m",), "scalar16", 0, 100),
    Layer("precipitation", "강수", "mm/h", ("precip_rate", "cloud", "snow"), "precip", 0, 100),
)

LAYERS_BY_ID = {layer.id: layer for layer in LAYERS}
