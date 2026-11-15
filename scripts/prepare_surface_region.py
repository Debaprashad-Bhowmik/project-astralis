"""Pack a NASA LROC equirectangular terrain crop for the browser."""

import argparse
import gzip
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.fill import fillnodata
from rasterio.warp import transform
from rasterio.windows import Window


def prepare(source, output, latitude, longitude):
    with rasterio.open(source) as dataset:
        projection = dataset.crs.to_dict()
        if projection["proj"] != "eqc" or dataset.transform.b or dataset.transform.d:
            raise ValueError("Expected a north-up lunar equirectangular raster.")
        if dataset.res[0] != dataset.res[1]:
            raise ValueError("Expected square terrain cells.")
        geographic = dataset.crs.geodetic_crs
        x, y = transform(geographic, dataset.crs, [longitude], [latitude])
        row, col = dataset.index(x[0], y[0])
        crop = Window(col - 512, row - 512, 1024, 1024)
        surface = dataset.read(1, masked=True, window=crop, boundless=True)
        affine = dataset.window_transform(crop)
    valid = ~np.ma.getmaskarray(surface)
    heights = fillnodata(surface.filled(np.nan), mask=valid.astype("uint8"), max_search_distance=12)
    if not np.isfinite(heights).all() or np.count_nonzero(~valid) > heights.size * .001:
        raise ValueError("The selected window needs more than small-gap interpolation.")
    scale = .05
    offset = float(np.floor(heights.min()) - 1)
    quantized = np.rint((heights - offset) / scale)
    if quantized.max() > 65535:
        raise ValueError("Elevations exceed the browser grid's encoding range.")
    output.write_bytes(gzip.compress(quantized.astype("<u2").tobytes(), mtime=0))
    metadata = {
        "product": Path(source).stem,
        "file": output.name,
        "spacing": affine.a,
        "left": affine.c,
        "top": affine.f,
        "width": heights.shape[1],
        "height": heights.shape[0],
        "scale": scale,
        "offset": offset,
        "centralMeridian": projection["lon_0"],
        "standardParallel": projection["lat_ts"],
        "latitudeOfOrigin": projection["lat_0"],
        "falseEasting": projection["x_0"],
        "falseNorthing": projection["y_0"],
        "radius": projection["R"],
    }
    output.with_suffix("").with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"{heights.shape[1]} x {heights.shape[0]} cells, {affine.a:g} m spacing, {np.count_nonzero(~valid)} gap cells filled")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("output", type=Path)
    parser.add_argument("latitude", type=float)
    parser.add_argument("longitude", type=float)
    args = parser.parse_args()
    prepare(args.source, args.output, args.latitude, args.longitude)
