"""Export nested LOLA elevation grids for browser illumination calculations."""

import argparse
import gzip
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds


PRODUCTS = [
    ("regional", "LDEM_60S_240MPP_ADJ.TIF", 960, (-576000, -576000, 576000, 576000)),
    ("cap", "LDEM_80S_80MPP_ADJ.TIF", 240, (-192000, -192000, 192000, 192000)),
    ("central", "LDEM_80S_80MPP_ADJ.TIF", 80, (-64000, -64000, 64000, 64000)),
    ("shackleton", "Site04_final_adj_5mpp_surf.tif", 10, None),
]


def export(source, output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, filename, spacing, bounds in PRODUCTS:
        with rasterio.open(source / filename) as raster:
            assert raster.transform.b == raster.transform.d == 0
            left, bottom, right, top = bounds or raster.bounds
            width = round((right - left) / spacing)
            height = round((top - bottom) / spacing)
            right, bottom = left + width * spacing, top - height * spacing
            heights = raster.read(1, window=from_bounds(left, bottom, right, top, raster.transform),
                                  out_shape=(height, width), resampling=Resampling.average, masked=True)
        assert np.isfinite(heights.compressed()).all() and heights.count() > 0
        # Two bytes per pixel, in half-meter increments. Zero is reserved for missing data.
        encoded = np.where(heights.mask, 0, np.round((heights.filled(0) + 10000) * 2)).astype("<u2")
        file = name + ".bin.gz"
        (output / file).write_bytes(gzip.compress(encoded.tobytes(), compresslevel=6, mtime=0))
        manifest.append(dict(name=name, source=filename, file=file, spacing=spacing, left=left, top=top,
                             width=width, height=height))
        print(name, width, height, spacing, float(heights.min()), float(heights.max()), (output / file).stat().st_size)
    (output / "grids.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    export_illumination(source, output)


def export_illumination(source, output):
    filename = "AVGVISIB_75S_120M_201608.TIF"
    with rasterio.open(source / filename) as raster:
        extent = 192000
        spacing = int(raster.transform.a)
        assert spacing == 120 and abs(raster.transform.e) == spacing
        window = from_bounds(-extent, -extent, extent, extent, raster.transform)
        values = raster.read(1, window=window, masked=True)
        scale, offset = raster.scales[0], raster.offsets[0]
        # Keep the cap, which is the portion displayed in the planner.
        axis = -extent + (np.arange(values.shape[1]) + .5) * spacing
        polar_radius = 2 * 1_737_400 * np.tan(np.deg2rad(3.02))
        outside = axis[:, None] ** 2 + axis[None, :] ** 2 > polar_radius ** 2
    encoded = np.where(np.ma.getmaskarray(values) | outside, 0, values.filled(0) + 1).astype("<u2")
    file = "illumination.bin.gz"
    (output / file).write_bytes(gzip.compress(encoded.tobytes(), compresslevel=6, mtime=0))
    metadata = dict(name="NASA average solar illumination", source=filename, file=file, spacing=spacing, left=-extent, top=extent,
                    width=values.shape[1], height=values.shape[0], scale=scale, offset=offset-scale)
    (output / "illumination.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/polar-shadows"))
    args = parser.parse_args()
    export(args.source, args.output)
