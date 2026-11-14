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
SPACE_FRAME = "ECLIPJ2000"
SPACE_STEP = 3600
KERNELS = ("naif0012.tls", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf")
SITES = [
    ("odysseus", "Odysseus", "Malapert A", "Historic landing · IM-1", -80.13, 1.44, "nssdc"),
    ("athena", "Athena", "Mons Mouton", "Historic landing · IM-2", -84.7906, 29.1957, "nssdc"),
    ("mouton", "Mons Mouton", "IM-4 / CP-22", "Future CLPS target · feature center", -84.60, 31.00, "16070"),
    ("ridge", "Connecting Ridge", "South polar ridge", "NASA study point", -89.4632, -137.49, "nasa-surface"),
    ("peak", "Peak near Shackleton", "South polar peak", "NASA study point", -88.811, 123.6901, "nasa-surface"),
    ("haworth", "Haworth", "Crater center", "Named feature center", -87.20, -7.49, "14502"),
    ("shoemaker", "Shoemaker", "Crater center", "Named feature center", -88.14, 45.91, "5494"),
    ("shackleton", "Shackleton", "Crater center", "Named feature center", -89.67, 129.78, "5450"),
    ("shackleton-rim", "Shackleton Rim", "LOLA Site 04", "NASA study point", -89.7668, -171.87, "nasa-surface"),
]
HISTORIC_SITES = [
    ("Luna 9", "Oceanus Procellarum · reported vicinity", 7.13, -64.37),
    ("Surveyor 1", "Oceanus Procellarum", -2.4745, -43.3398),
    ("Luna 13", "Oceanus Procellarum · reported vicinity", 18.87, -62.05),
    ("Surveyor 3", "Oceanus Procellarum", -3.0162, -23.4180),
    ("Surveyor 5", "Mare Tranquillitatis", 1.4551, 23.1943),
    ("Surveyor 6", "Sinus Medii", 0.4742, -1.4275),
    ("Surveyor 7", "Near Tycho", -40.9812, -11.5127),
    ("Apollo 11", "Mare Tranquillitatis", 0.67416, 23.47314),
    ("Apollo 12", "Oceanus Procellarum", -3.0128, -23.4219),
    ("Luna 16", "Mare Fecunditatis", -0.5137, 56.3638),
    ("Luna 17", "Mare Imbrium", 38.23764, -35.00163),
    ("Apollo 14", "Fra Mauro", -3.64589, -17.47194),
    ("Apollo 15", "Hadley–Apennine", 26.13239, 3.63330),
    ("Luna 20", "Apollonius highlands", 3.7863, 56.6242),
    ("Apollo 16", "Descartes Highlands", -8.9734, 15.5011),
    ("Apollo 17", "Taurus–Littrow", 20.1911, 30.7723),
    ("Luna 21", "Le Monnier", 25.9994, 30.4076),
    ("Luna 23", "Mare Crisium", 12.6667, 62.1511),
    ("Luna 24", "Mare Crisium", 12.7142, 62.2129),
    ("Chang'e 3", "Mare Imbrium", 44.1214, -19.5117),
    ("Chang'e 4", "Von Kármán · far side", -45.4561, 177.5885),
    ("Chang'e 5", "Oceanus Procellarum", 43.0576, -51.9161),
    ("Chandrayaan-3", "Vikram landing site", -69.3741, 32.32),
    ("SLIM", "Near Shioli", -13.3160, 25.2510),
    ("Chang'e 6", "Apollo Basin · far side", -41.6385, -153.9852),
    ("Blue Ghost 1", "Mare Crisium", 18.562, 61.810),
]
TARGETS = [
    ("reiner-gamma", "Reiner Gamma", "IM-3 / CP-11", "Future CLPS target · feature center", 7.39, -58.96, "4987"),
    ("schrodinger", "Schrödinger Basin", "CS-11", "Future CLPS target · feature center", -74.73, 132.93, "5381"),
    ("gruithuisen", "Mons Gruithuisen Gamma", "Blue Ghost 3 / CP-21", "Future CLPS target · feature center", 36.56, -40.72, "3982"),
    ("nassau", "Nassau Crater", "Blue Ghost 2 / CS-3/4", "Future CLPS target · feature center", -24.9137, 177.337, "4159"),
]
HORIZON_RANGE = 350_000
GLOBAL_STEP = 1900
TILE_SIZE = 480


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

    def interpolate(self, x, y):
        col, row = self.transform * (x, y)
        left = np.floor(col - .5)
        top = np.floor(row - .5)
        dx, dy = col - .5 - left, row - .5 - top
        position = ~self.transform
        points = [self.sample(*(position * (left + i + .5, top + j + .5)))
                  for j in (0, 1) for i in (0, 1)]
        north = points[0] * (1 - dx) + points[1] * dx
        south = points[2] * (1 - dx) + points[3] * dx
        return north * (1 - dy) + south * dy


def global_tiles(source, output):
    tiles = output / "terrain"
    tiles.mkdir(exist_ok=True)
    with Image.open(source / "ldem_16_uint.tif") as image:
        raw = np.asarray(image)
    assert raw.shape == (2880, 5760)
    for row in range(6):
        for col in range(12):
            tile = raw[row*TILE_SIZE:(row+1)*TILE_SIZE, col*TILE_SIZE:(col+1)*TILE_SIZE]
            tile.astype("<u2").tofile(tiles / f"{col}-{row}.bin")
    return raw


def global_height(grid, latitude, longitude):
    col = np.floor((longitude / np.pi + 1) * grid.shape[1] / 2).astype(int) % grid.shape[1]
    row = np.clip(np.floor((.5 - latitude / np.pi) * grid.shape[0]).astype(int), 0, grid.shape[0] - 1)
    return grid[row, col] * .5 - 10_000


def polar_elevation(nearby, distant, detail, x, y, distance):
    heights = np.where((distance < 25_000) & np.isfinite(nearby), nearby, distant)
    if detail is not None:
        fine = detail.interpolate(x, y)
        # Both DEMs are in the same frame. Taper the handoff at the local raster boundary.
        col, row = detail.transform * (x, y)
        rows, cols = detail.grid.shape
        edge = np.minimum(np.minimum(col, cols - col), np.minimum(row, rows - row))
        blend = np.clip((edge - 2) / 50, 0, 1)
        heights = np.where(np.isfinite(fine) & (blend > 0), heights + (fine - heights) * blend, heights)
    return heights


def compile_sites(source, output):
    global_grid = global_tiles(source, output)
    wide = Terrain(source / "LDEM_60S_240MPP_ADJ.TIF")
    local = Terrain(source / "LDEM_80S_80MPP_ADJ.TIF")
    rim = Terrain(source / "Site04_final_adj_5mpp_surf.tif")
    for grid in (wide, local, rim):
        check = pyproj.Transformer.from_crs(grid.projection.geodetic_crs, grid.projection, always_xy=True)
        assert np.allclose(check.transform(29.2, -84.8), projected(*np.deg2rad([-84.8, 29.2])), atol=1)

    bearing = np.deg2rad(np.arange(0, 360, 0.5))[:, None]
    regional_ranges = np.concatenate((np.arange(80, 25_000, 80), np.arange(25_000, HORIZON_RANGE + 1, 240)))
    rim_ranges = np.concatenate((np.arange(5, 1000, 5), np.arange(1000, 9000, 25), regional_ranges[regional_ranges >= 9000]))
    sites = []
    mesh_dir = output / "surface"
    mesh_dir.mkdir(exist_ok=True)
    for code, name, location, kind, latitude, longitude, provenance in SITES:
        phi, lon = np.deg2rad([latitude, longitude])
        detail = rim if code == "shackleton-rim" else None
        distance = rim_ranges if detail else regional_ranges
        central = distance / RADIUS
        cos_c, sin_c = np.cos(central), np.sin(central)
        dest_lat = np.arcsin(np.sin(phi) * cos_c + np.cos(phi) * sin_c * np.cos(bearing))
        dest_lon = lon + np.arctan2(np.sin(bearing) * sin_c * np.cos(phi), cos_c - np.sin(phi) * np.sin(dest_lat))
        x, y = projected(dest_lat, dest_lon)
        heights = polar_elevation(local.sample(x, y), wide.sample(x, y), detail, x, y, distance)
        assert np.isfinite(heights).all(), name
        site_x, site_y = projected(phi, lon)
        height = float(detail.interpolate(site_x, site_y) if detail else local.sample(site_x, site_y))
        assert np.isfinite(height), name
        radii = RADIUS + heights
        angles = np.rad2deg(np.arctan2(radii * cos_c - (RADIUS + height + 2), radii * sin_c))
        profile = angles.max(axis=1).round(4).tolist()
        sites.append(dict(id=code, name=name, location=location, kind=kind, lat=latitude, lon=longitude,
                          height=height, horizon=profile, source=provenance, terrain="LOLA 5/80/240 m" if detail else "LOLA 80/240 m"))
        mesh_bearing = np.deg2rad(np.arange(0, 360, 2))[None, :]
        mesh_range = np.concatenate((np.arange(0, 5000, 80), np.arange(5000, 25000, 240), np.arange(25000, 350000, 1900), [350000]))[:, None]
        if detail:
            mesh_range = np.concatenate((np.arange(0, 250, 5), np.arange(250, 1500, 15), np.arange(1500, 7500, 100),
                                         np.arange(7500, 25000, 300), np.arange(25000, 350000, 4000), [350000]))[:, None]
        assert mesh_range.size * mesh_bearing.size <= 65_535
        sin_arc = np.sin(mesh_range / RADIUS)
        cos_arc = np.cos(mesh_range / RADIUS)
        mesh_lat = np.arcsin(np.sin(phi) * cos_arc + np.cos(phi) * sin_arc * np.cos(mesh_bearing))
        mesh_lon = lon + np.arctan2(np.sin(mesh_bearing) * sin_arc, np.cos(phi) * cos_arc - np.sin(phi) * sin_arc * np.cos(mesh_bearing))
        mesh_x, mesh_y = projected(mesh_lat, mesh_lon)
        mesh_radii = RADIUS + polar_elevation(local.interpolate(mesh_x, mesh_y), wide.interpolate(mesh_x, mesh_y), detail, mesh_x, mesh_y, mesh_range)
        assert np.isfinite(mesh_radii).all(), name
        mesh = np.stack((mesh_radii * sin_arc * np.sin(mesh_bearing), mesh_radii * cos_arc - mesh_radii[0, 0] - 2,
                         mesh_radii * sin_arc * np.cos(mesh_bearing)), axis=-1)
        mesh.astype("<f4").tofile(mesh_dir / f"{code}.bin")
        print(name, f"height {height:.1f} m", f"horizon {min(profile):.2f} to {max(profile):.2f} deg")

    historic = [(name.lower().replace("'", "").replace(" ", "-"), name, location, "Historic landing", lat, lon, "nssdc")
                for name, location, lat, lon in HISTORIC_SITES]
    central = np.arange(GLOBAL_STEP, HORIZON_RANGE + 1, GLOBAL_STEP) / RADIUS
    cos_c, sin_c = np.cos(central), np.sin(central)
    for code, name, location, kind, latitude, longitude, provenance in historic + TARGETS:
        phi, lon = np.deg2rad([latitude, longitude])
        dest_lat = np.arcsin(np.sin(phi) * cos_c + np.cos(phi) * sin_c * np.cos(bearing))
        dest_lon = lon + np.arctan2(np.sin(bearing) * sin_c * np.cos(phi), cos_c - np.sin(phi) * np.sin(dest_lat))
        heights = global_height(global_grid, dest_lat, dest_lon)
        height = float(global_height(global_grid, phi, lon))
        radii = RADIUS + heights
        angles = np.rad2deg(np.arctan2(radii * cos_c - (RADIUS + height + 2), radii * sin_c))
        sites.append(dict(id=code, name=name, location=location, kind=kind, lat=latitude, lon=longitude,
                          height=height, horizon=angles.max(axis=1).round(4).tolist(), source=provenance, terrain="LOLA 16 px/°"))

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


def epochs_for(step):
    start = START.strftime("%Y-%m-%dT%H:%M:%S")
    epoch = spice.str2et(start)
    count = int((END - START).total_seconds() / step) + 1
    return epoch + step * np.arange(count, dtype=float)


def compile_ephemeris(output):
    epochs = epochs_for(STEP)
    vectors = []
    for target in ("SUN", "EARTH"):
        positions, _ = spice.spkpos(target, epochs, FRAME, "CN+S", "MOON")
        vectors.append(np.asarray(positions))
        print(target, len(positions), "vectors")
    coordinates = np.rint(np.column_stack(vectors) * 10).astype("<i4")
    delta = np.diff(coordinates, axis=0, prepend=np.zeros((1, 6), dtype="<i4"))
    delta.astype("<i4").tofile(output / "ephemeris.bin")
    return len(epochs)


def compile_space_view(output):
    epochs = epochs_for(SPACE_STEP)
    positions = [spice.spkpos(target, epochs, SPACE_FRAME, "NONE", "EARTH")[0] for target in ("MOON", "SUN")]
    rotations = np.array([spice.m2q(spice.pxform(FRAME, SPACE_FRAME, epoch)) for epoch in epochs])
    np.column_stack((*positions, rotations)).astype("<f4").tofile(output / "space-positions.bin")
    return len(epochs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory with NASA kernels and TIFF files")
    parser.add_argument("--output", type=Path, default=Path("data"))
    parser.add_argument("--space-only", action="store_true", help="Update only the Earth-centered overview dataset")
    parser.add_argument("--sites-only", action="store_true", help="Update site profiles, map, and global elevation tiles")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.sites_only:
        count = int((END - START).total_seconds() / STEP) + 1
    else:
        for name in KERNELS:
            spice.furnsh(str(args.source / name))
        space_count = compile_space_view(args.output)
        if args.space_only:
            print("Earth-centered samples:", space_count)
            raise SystemExit(0)
        count = compile_ephemeris(args.output)
    sites, extent = compile_sites(args.source, args.output)
    manifest = dict(start=START.isoformat(), end=END.isoformat(), step=STEP, count=count, frame=FRAME,
                    kernels=KERNELS, catalog=sites, mapExtent=extent, terrainDistance=HORIZON_RANGE)
    (args.output / "catalog.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
