"""Forecast layer definitions shared by the GFS reader and the frame encoder.

Each layer names the GRIB messages it needs, how raw values become physical
units, and how the encoder packs them into image channels. The manifest
written by build.py publishes the same encodings and ranges, so the web app
reads them from data rather than repeating them.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Layer:
    id: str
    title: str
    unit: str
    # GRIB (variable, level) pairs read for this layer, in decode order.
    fields: tuple
    encoding: str  # "scalar16", "uv12" or "precip"
    min: float
    max: float


LAYERS = (
    Layer("wind", "바람", "m/s", (("UGRD", "10 m above ground"), ("VGRD", "10 m above ground")), "uv12", -80, 80),
    Layer("gust", "돌풍", "m/s", (("GUST", "surface"),), "scalar16", 0, 100),
    Layer("pressure", "기압", "hPa", (("PRMSL", "mean sea level"),), "scalar16", 870, 1090),
    Layer("temperature", "기온", "°C", (("TMP", "2 m above ground"),), "scalar16", -80, 60),
    Layer("humidity", "습도", "%", (("RH", "2 m above ground"),), "scalar16", 0, 100),
    Layer(
        "precipitation",
        "강수",
        "mm/h",
        (("PRATE", "surface"), ("TCDC", "entire atmosphere"), ("CSNOW", "surface")),
        "precip",
        0,
        100,
    ),
)

LAYERS_BY_ID = {layer.id: layer for layer in LAYERS}


def to_physical(variable, values):
    """Convert GRIB units to the units the layers publish."""
    if variable == "PRMSL":
        return values / 100.0  # Pa -> hPa
    if variable == "TMP":
        return values - 273.15  # K -> °C
    if variable == "PRATE":
        return values * 3600.0  # kg m-2 s-1 -> mm/h
    return values
