"""Serve Astralis and fetch local windows of NASA lunar elevation data."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import gzip
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import struct
from threading import Thread
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen
import webbrowser

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.io import MemoryFile
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
RADIUS = 1737400
CROP = 512
POSTINGS = 256
TILE_SIZE = 10 * POSTINGS
GLOBAL_ROWS = 180 * POSTINGS
GLOBAL_COLS = 360 * POSTINGS
GLOBAL_SPACING = math.radians(1 / POSTINGS) * RADIUS
GLOBAL_DATA = "https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m"
POLAR_DATA = "https://pgda.gsfc.nasa.gov/products/90"
POLAR_TIFF = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF"
GMT_MIRRORS = (
    "https://mirrors.nju.edu.cn/gmtdata/server/",
    "https://oceania.generic-mapping-tools.org/server/",
)


@lru_cache(maxsize=12)
def global_tile(tile_row, tile_col):
    lat, lon = 80 - 10 * tile_row, -180 + 10 * tile_col
    lat_name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02}"
    lon_name = f"{'E' if lon >= 0 else 'W'}{abs(lon):03}"
    name = f"moon/moon_relief/moon_relief_14s_p/{lat_name}{lon_name}.moon_relief_14s_p.jp2"
    for mirror in GMT_MIRRORS:
        try:
            with urlopen(mirror + name, timeout=8) as response:
                content = response.read(12_000_001)
            if len(content) > 12_000_000:
                raise ValueError("Oversized elevation tile")
            with MemoryFile(content) as file, file.open() as grid:
                if grid.shape != (TILE_SIZE, TILE_SIZE):
                    raise ValueError("Unexpected elevation tile dimensions")
                if not np.allclose(tuple(grid.bounds), (lon, lat, lon + 10, lat + 10)):
                    raise ValueError("Unexpected elevation tile origin")
                return grid.read(1)
        except (OSError, ValueError):
            continue
    raise OSError(f"Could not load USGS LOLA tile {lat_name}{lon_name}")


def global_crop(lat, lon):
    row = int((90 - lat) * POSTINGS)
    col = int((180 + lon) * POSTINGS)
    first_row, first_col = row - CROP // 2, col - CROP // 2
    rows = np.clip(np.arange(first_row, first_row + CROP), 0, GLOBAL_ROWS - 1)
    cols = np.arange(first_col, first_col + CROP) % GLOBAL_COLS
    row_blocks, col_blocks = rows // TILE_SIZE, cols // TILE_SIZE
    keys = [(int(y), int(x)) for y in np.unique(row_blocks) for x in np.unique(col_blocks)]
    result = np.empty((CROP, CROP), dtype=np.float32)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for (y, x), tile in zip(keys, pool.map(lambda key: global_tile(*key), keys)):
            tile_rows, tile_cols = row_blocks == y, col_blocks == x
            values = tile[np.ix_(rows[tile_rows] % TILE_SIZE, cols[tile_cols] % TILE_SIZE)]
            result[np.ix_(tile_rows, tile_cols)] = np.where(values == -32768, np.nan, values * .5)
    return result, {
        "dataset": "Global LOLA via USGS", "sourceUrl": GLOBAL_DATA, "spacing": GLOBAL_SPACING,
        "left": first_col * GLOBAL_SPACING - math.pi * RADIUS - math.radians(lon) * RADIUS,
        "top": math.pi * RADIUS / 2 - first_row * GLOBAL_SPACING,
        "centralMeridian": lon, "standardParallel": 0, "latitudeOfOrigin": 0,
        "falseEasting": 0, "falseNorthing": 0, "radius": RADIUS,
    }


def polar_crop(lat, lon):
    distance = 2 * RADIUS * math.tan(math.radians(90 + lat) / 2)
    x, y = distance * math.sin(math.radians(lon)), distance * math.cos(math.radians(lon))
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="8",
        GDAL_HTTP_MULTIRANGE="SERIAL", CPL_VSIL_CURL_CHUNK_SIZE="262144",
    ):
        with rasterio.open("/vsicurl/" + POLAR_TIFF) as grid:
            row, col = grid.index(x, y)
            window = Window(col - CROP // 2, row - CROP // 2, CROP, CROP)
            heights = grid.read(1, window=window, masked=True).filled(np.nan)
            transform = grid.window_transform(window)
    if not np.isfinite(heights[CROP // 2 - 1:CROP // 2 + 2, CROP // 2 - 1:CROP // 2 + 2]).all():
        raise ValueError("The 10 m polar terrain has a gap at this point")
    return heights, {
        "dataset": "NASA LOLA South Pole", "sourceUrl": POLAR_DATA, "spacing": transform.a,
        "left": transform.c, "top": transform.f,
    }


@lru_cache(maxsize=16)
def terrain_payload(lat, lon):
    if lat <= -83.1:
        try:
            heights, grid = polar_crop(lat, lon)
        except (RasterioIOError, ValueError):
            heights, grid = global_crop(lat, lon)
    else:
        heights, grid = global_crop(lat, lon)
    valid = np.isfinite(heights)
    if not valid.any():
        raise ValueError("The elevation window contains no data")
    offset = math.floor(float(heights[valid].min())) - 1
    step = max(.1, math.ceil((float(heights[valid].max()) - offset) * 10 / 65534) / 10)
    values = np.zeros(heights.shape, dtype="<u2")
    values[valid] = np.rint((heights[valid] - offset) / step).astype("<u2")
    grid.update(width=heights.shape[1], height=heights.shape[0], scale=step, offset=offset)
    metadata = json.dumps(grid, separators=(",", ":")).encode()
    return gzip.compress(struct.pack("<I", len(metadata)) + metadata + values.tobytes(), compresslevel=4)


class AstralisHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Revalidate app files on each load so edited modules never mix with stale cached ones.
        if urlsplit(self.path).path != "/api/terrain":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != "/api/terrain":
            return super().do_GET()
        query = parse_qs(url.query)
        try:
            lat, lon = (float(query[key][0]) for key in ("lat", "lon"))
            if not -90 <= lat <= 90 or not -180 <= lon <= 180:
                raise ValueError
        except (KeyError, ValueError):
            self.send_error(400, "Expected lunar latitude and east longitude")
            return
        lon = (lon + 180) % 360 - 180
        try:
            payload = terrain_payload(round(lat, 6), round(lon, 6))
        except (OSError, ValueError) as error:
            self.log_error("%s", error)
            self.send_error(503, "The elevation source is temporarily unavailable")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=4173, type=int, help="use 0 to pick an available port")
    parser.add_argument("--open", action="store_true", help="open Lunar Landing Site Navigator in the default browser")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), AstralisHandler) as server:
        url = f"http://localhost:{server.server_port}/"
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        print(f"Lunar Landing Site Navigator v{version} by team Astralis is running at {url}", flush=True)
        if args.open:
            Thread(target=webbrowser.open, args=(url,), daemon=True).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
