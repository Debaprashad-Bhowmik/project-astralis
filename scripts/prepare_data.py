"""Build the browser dataset from NASA JPL SPICE and Goddard LOLA products."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
import pyproj
import rasterio
import spiceypy as spice
from PIL import Image


RADIUS = 1_737_400.0
STEP = 900
START = datetime(2024, 1, 1, tzinfo=timezone.utc)
END = datetime(2031, 1, 1, tzinfo=timezone.utc)
FRAME = "MOON_ME_DE440_ME421"
KERNELS = ("naif0012.tls", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf")
SITES = [
    ("odysseus", "Odysseus", "Malapert A", "Historic landing · IM-1", -80.13, 1.44, "nssdc"),
    ("athena", "Athena", "Mons Mouton", "Historic landing · IM-2", -84.7906, 29.1957, "nssdc"),
    ("mouton", "Mons Mouton", "Plateau center", "Named feature center", -84.60, 31.00, "16070"),
    ("ridge", "Connecting Ridge", "South polar ridge", "NASA study point", -89.4632, -137.49, "nasa-surface"),
    ("peak", "Peak near Shackleton", "South polar peak", "NASA study point", -88.811, 123.6901, "nasa-surface"),
    ("haworth", "Haworth", "Crater center", "Named feature center", -87.20, -7.49, "14502"),
    ("shoemaker", "Shoemaker", "Crater center", "Named feature center", -88.14, 45.91, "5494"),
    ("shackleton", "Shackleton", "Crater center", "Named feature center", -89.67, 129.78, "5450"),
]
HORIZON_RANGE = 350_000


def projected(phi, longitude):
    rho = 2 * RADIUS * np.tan(np.pi / 4 + phi / 2)
    return rho * np.sin(longitude), rho * np.cos(longitude)


class Terrain:
    def __init__(self, path):
        with rasterio.open(path) as raster:
            self.grid = raster.read(1)
            self.transform = ~raster.transform
            self.nodata = raster.nodata
            self.projection = pyproj.CRS.from_user_input(raster.crs)

    def sample(self, x, y):
        col, row = self.transform * (x, y)
        row = np.floor(row).astype(int)
        col = np.floor(col).astype(int)
        valid = (row >= 0) & (col >= 0) & (row < self.grid.shape[0]) & (col < self.grid.shape[1])
        values = self.grid[np.clip(row, 0, self.grid.shape[0] - 1), np.clip(col, 0, self.grid.shape[1] - 1)]
        return np.where(valid & (values != self.nodata), values, np.nan)


def compile_sites(source, output):
    wide = Terrain(source / "LDEM_60S_240MPP_ADJ.TIF")
    local = Terrain(source / "LDEM_80S_80MPP_ADJ.TIF")
    for grid in (wide, local):
        check = pyproj.Transformer.from_crs(grid.projection.geodetic_crs, grid.projection, always_xy=True)
        assert np.allclose(check.transform(29.2, -84.8), projected(*np.deg2rad([-84.8, 29.2])), atol=1)

    bearing = np.deg2rad(np.arange(0, 360, 0.5))[:, None]
    distance = np.concatenate((np.arange(80, 25_000, 80), np.arange(25_000, HORIZON_RANGE + 1, 240)))
    central = distance / RADIUS
    cos_c, sin_c = np.cos(central), np.sin(central)
    sites = []
    for code, name, location, kind, latitude, longitude, provenance in SITES:
        phi, lon = np.deg2rad([latitude, longitude])
        dest_lat = np.arcsin(np.sin(phi) * cos_c + np.cos(phi) * sin_c * np.cos(bearing))
        dest_lon = lon + np.arctan2(np.sin(bearing) * sin_c * np.cos(phi), cos_c - np.sin(phi) * np.sin(dest_lat))
        x, y = projected(dest_lat, dest_lon)
        nearby = local.sample(x, y)
        distant = wide.sample(x, y)
        heights = np.where((distance < 25_000) & np.isfinite(nearby), nearby, distant)
        assert np.isfinite(heights).all(), name
        site_x, site_y = projected(phi, lon)
        height = float(local.sample(site_x, site_y))
        assert np.isfinite(height), name
        radii = RADIUS + heights
        angles = np.rad2deg(np.arctan2(radii * cos_c - (RADIUS + height + 2), radii * sin_c))
        profile = angles.max(axis=1).round(4).tolist()
        sites.append(dict(id=code, name=name, location=location, kind=kind, lat=latitude, lon=longitude,
                          height=height, horizon=profile, source=provenance))
        print(name, f"height {height:.1f} m", f"horizon {min(profile):.2f} to {max(profile):.2f} deg")

    extent = 315_000
    axis = np.linspace(-extent, extent, 740)
    x, y = np.meshgrid(axis, axis[::-1])
    heights = local.sample(x, y)
    heights = np.where(np.isfinite(heights), heights, wide.sample(x, y))
    dy, dx = np.gradient(heights, axis[1] - axis[0])
    shade = (0.46 + 0.65 * dx + 0.63 * dy) / np.sqrt(1 + dx * dx + dy * dy)
    shade = np.clip(shade, -0.25, 1)
    luminance = np.clip(52 + 116 * shade + heights * .004, 28, 210)
    colors = np.stack((luminance * .88, luminance * .93, luminance), axis=-1).astype(np.uint8)
    Image.fromarray(colors).save(output / "polar-relief.webp", quality=86)
    return sites, extent


def compile_ephemeris(source, output):
    for name in KERNELS:
        spice.furnsh(str(source / name))
    start = START.strftime("%Y-%m-%dT%H:%M:%S")
    epoch = spice.str2et(start)
    count = int((END - START).total_seconds() / STEP) + 1
    epochs = epoch + STEP * np.arange(count, dtype=float)
    vectors = []
    for target in ("SUN", "EARTH"):
        positions, _ = spice.spkpos(target, epochs, FRAME, "CN+S", "MOON")
        vectors.append(np.asarray(positions))
        print(target, len(positions), "vectors")
    coordinates = np.rint(np.column_stack(vectors) * 10).astype("<i4")
    delta = np.diff(coordinates, axis=0, prepend=np.zeros((1, 6), dtype="<i4"))
    delta.astype("<i4").tofile(output / "ephemeris.bin")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory with NASA kernels and TIFF files")
    parser.add_argument("--output", type=Path, default=Path("data"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    count = compile_ephemeris(args.source, args.output)
    sites, extent = compile_sites(args.source, args.output)
    manifest = dict(start=START.isoformat(), end=END.isoformat(), step=STEP, count=count, frame=FRAME,
                    kernels=KERNELS, catalog=sites, mapExtent=extent, terrainDistance=HORIZON_RANGE)
    (args.output / "catalog.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
