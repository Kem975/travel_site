#!/usr/bin/env python3
"""Turn the Natural Earth II raster into the globe's 'terrain' tiles.

Output goes to frontend/public/tiles/terrain/, served as plain static files — no
tile server and no third-party dependency at runtime.

The source is equirectangular (EPSG:4326) while MapLibre wants Web Mercator tiles,
so each output row is remapped through the inverse Mercator latitude.

Only needed when regenerating tiles; the result is committed. Requires Pillow + numpy.

    python3 deployment/build-terrain-tiles.py
"""

import io
import math
import pathlib
import sys
import urllib.request
import zipfile

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the sources are 10800x5400, well past Pillow's bomb guard

TILE = 512
MAX_ZOOM = 4  # the globe view never needs more; z4 already exceeds the source resolution
QUALITY = 82

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'frontend' / 'public' / 'tiles' / 'terrain'
SOURCE_URL = 'https://naciscdn.org/naturalearth/50m/raster/NE2_50M_SR_W.zip'
CACHE = pathlib.Path('/tmp/NE2_50M_SR_W.zip')


def fetch(url: str, cache: pathlib.Path) -> Image.Image:
    if not cache.exists():
        print(f'  downloading {url}', flush=True)
        urllib.request.urlretrieve(url, cache)
    with zipfile.ZipFile(cache) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.tif'))
        return Image.open(io.BytesIO(z.read(name))).convert('RGB')


def mercator_lat(y_norm: float) -> float:
    """Web Mercator normalised Y (0..1) -> latitude in degrees."""
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y_norm))))


def build(src: Image.Image, out_dir: pathlib.Path) -> int:
    pixels = np.asarray(src)
    src_h, src_w = pixels.shape[:2]
    total = 0
    for z in range(MAX_ZOOM + 1):
        n = 2 ** z
        for ty in range(n):
            ys = (ty + (np.arange(TILE) + 0.5) / TILE) / n
            lats = np.array([mercator_lat(v) for v in ys])
            rows = np.clip(((90 - lats) / 180 * src_h).astype(int), 0, src_h - 1)
            for tx in range(n):
                xs = (tx + (np.arange(TILE) + 0.5) / TILE) / n
                cols = np.clip((xs * src_w).astype(int), 0, src_w - 1)
                target = out_dir / str(z) / str(tx)
                target.mkdir(parents=True, exist_ok=True)
                path = target / f'{ty}.webp'
                Image.fromarray(pixels[np.ix_(rows, cols)]).save(
                    path, 'WEBP', quality=QUALITY, method=4
                )
                total += path.stat().st_size
        print(f'  z{z}: {n * n} tiles', flush=True)
    return total


def main() -> int:
    total = build(fetch(SOURCE_URL, CACHE), OUT_DIR)
    print(f'{total / 1048576:.1f} MB on disk', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
