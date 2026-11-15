"""Sample 100 m-baseline LOLA slope and roughness across the South Pole.

Inputs: the 50 m/pixel SLP and ROUGH products published at
https://pgda.gsfc.nasa.gov/products/90 (or aligned South Pole crops).
"""

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds

MOON_RADIUS = 1_737_400
CAP_RADIUS = 2 * MOON_RADIUS * np.tan(np.deg2rad(3))


def export(slope_source, rough_source, output):
    extent = np.ceil(CAP_RADIUS / 50) * 50
    bounds = (-extent, -extent, extent, extent)
    with rasterio.open(slope_source) as slopes, rasterio.open(rough_source) as roughness:
        if (slopes.transform != roughness.transform or slopes.crs != roughness.crs
                or slopes.res != (50, 50) or slopes.shape != roughness.shape):
            raise ValueError("Use the aligned NASA 50 m slope and roughness GeoTIFFs.")
        window = from_bounds(*bounds, slopes.transform).round_offsets().round_lengths()
        transform = slopes.window_transform(window)
        slope = slopes.read(1, window=window, boundless=True, fill_value=np.nan)
        rough = roughness.read(1, window=window, boundless=True, fill_value=np.nan)
    east = transform.c + (np.arange(slope.shape[1]) + .5) * transform.a
    north = transform.f + (np.arange(slope.shape[0]) + .5) * transform.e
    block_cells = 80  # One representative 100 m patch per 4 km square.
    patches = []
    for row in range(0, slope.shape[0], block_cells):
        for col in range(0, slope.shape[1], block_cells):
            cells = np.s_[row:row + block_cells, col:col + block_cells]
            x, y = east[cells[1]], north[cells[0]]
            inside = np.hypot(x[None, :], y[:, None]) <= CAP_RADIUS - 50
            valid = inside & np.isfinite(slope[cells]) & np.isfinite(rough[cells])
            rows, cols = np.where(valid)
            if not rows.size:
                continue
            tilts, bumps = slope[cells][valid], rough[cells][valid]
            lowest = np.lexsort((bumps, tilts))[0]
            easting, northing = x[cols[lowest]], y[rows[lowest]]
            lat = np.rad2deg(2 * np.arctan2(np.hypot(easting, northing), 2 * MOON_RADIUS)) - 90
            lon = np.rad2deg(np.arctan2(easting, northing))
            patches.append([round(lat, 6), round(lon, 6), round(float(tilts[lowest]), 3), round(float(bumps[lowest]), 3)])
    Path(output).write_text(json.dumps(patches, separators=(",", ":")), encoding="utf-8")
    print(f"Exported {len(patches):,} sampled patches from 84°S to 90°S.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slope")
    parser.add_argument("roughness")
    parser.add_argument("output")
    args = parser.parse_args()
    export(args.slope, args.roughness, args.output)
