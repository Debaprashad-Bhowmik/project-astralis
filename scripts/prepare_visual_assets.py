"""Prepare display textures without changing the planner's scientific inputs.

Requires Pillow and NumPy. Download original imagery from the NASA URLs documented
in README.md, then pass the local TIFF paths. With no arguments, rebuild only the
packed elevation texture from the repository's lossless global LOLA tiles.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--moon-tiff", type=Path)
    parser.add_argument("--earth-tiff", type=Path)
    options = parser.parse_args()
    assets = ROOT / "assets"

    if options.moon_tiff:
        # NASA's 2019 CGI Moon Kit, lroc_color_poles_16k.tif.
        Image.MAX_IMAGE_PIXELS = 150_000_000
        with Image.open(options.moon_tiff) as source:
            if source.size != (16384, 8192):
                raise ValueError("Expected NASA's 16384 x 8192 LROC color map")
            source = source.convert("RGB")
            source.resize((8192, 4096), Image.Resampling.LANCZOS).save(
                assets / "moon-color-8k.webp", quality=90, method=6)
            directory = assets / "moon-tiles"
            directory.mkdir(exist_ok=True)
            for y in range(2):
                for x in range(4):
                    source.crop((x * 4096, y * 4096, (x + 1) * 4096, (y + 1) * 4096)).save(
                        directory / f"{x}-{y}.webp", quality=90, method=6)

    if options.earth_tiff:
        with Image.open(options.earth_tiff) as source:
            source.convert("RGB").save(assets / "earth-clouds.webp", quality=92, method=6)

    heights = np.empty((2880, 5760), dtype=np.uint16)
    for y in range(6):
        for x in range(12):
            values = np.fromfile(ROOT / "data" / "terrain" / f"{x}-{y}.bin", dtype="<u2")
            heights[y * 480:(y + 1) * 480, x * 480:(x + 1) * 480] = values.reshape(480, 480)
    # Decode in the shader as R*256 + G; original meters = value*0.5 - 10000.
    pixels = np.zeros((*heights.shape, 3), dtype=np.uint8)
    pixels[:, :, 0] = heights >> 8
    pixels[:, :, 1] = heights & 255
    Image.fromarray(pixels).save(assets / "moon-elevation.png")
    print("Prepared visual assets. Ephemeris, terrain tiles and rankings are unchanged.")


if __name__ == "__main__":
    main()
