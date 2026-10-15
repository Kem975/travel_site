#!/usr/bin/env python3
"""Turn the Natural Earth II raster into the globe's 'terrain' tiles.

Output goes to frontend/public/tiles/terrain/, served as plain static files — no
tile server and no third-party dependency at runtime.

The source is equirectangular (EPSG:4326) while MapLibre wants Web Mercator tiles,
so each output row is remapped through the inverse Mercator latitude.

Only needed when regenerating tiles; the result is committed. Requires Pillow + numpy.

    python3 deployment/build-terrain-tiles.py

Every output pixel is the *average* of the source pixels it covers, not one of them.
The first version of this script point-sampled — it computed an integer source index
per output pixel and took that one pixel. At z3, the level the globe shows at its
resting zoom, each output pixel spans roughly 13x13 source pixels, so that threw
away 168 of every 169 and aliased the shaded relief into noise. Averaging is why the
tiles look clean at low zoom, and it matters more than the source resolution does.

Both reductions go through np.add.reduceat, which sums contiguous groups: the
boundaries carry the Mercator stretch on the vertical axis and a plain uniform
split on the horizontal one.
"""

import io
import math
import pathlib
import sys
import tempfile
import urllib.request
import zipfile

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the source is 21600x10800, well past Pillow's bomb guard

TILE = 512
# z5 spans 32 * 512 = 16384 px across the world, still inside the 10m source's
# 21600 px; z6 would be 32768 and so pure upscaling. (The 50m source this script
# used before was only 10800 px wide, which z5 would already have outrun.)
MAX_ZOOM = 5
QUALITY = 82

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'frontend' / 'public' / 'tiles' / 'terrain'
# Natural Earth II with Shaded Relief and Water, at 1:10m. Same cartography as the
# 1:50m edition used before — same palette, same relief — rendered twice as large.
SOURCE_URL = 'https://naciscdn.org/naturalearth/10m/raster/NE2_HR_LC_SR_W.zip'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'NE2_HR_LC_SR_W.zip'


def fetch(url: str, cache: pathlib.Path) -> Image.Image:
    if not cache.exists():
        print(f'  downloading {url}', flush=True)
        urllib.request.urlretrieve(url, cache)
    with zipfile.ZipFile(cache) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.tif'))
        return Image.open(io.BytesIO(z.read(name))).convert('RGB')


def mercator_lat(y_norm: np.ndarray) -> np.ndarray:
    """Web Mercator normalised Y (0..1) -> latitude in degrees."""
    return np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * y_norm))))


def groups(edges: np.ndarray, limit: int) -> tuple[np.ndarray, np.ndarray]:
    """Source-index group starts and their lengths, from output-pixel edges.

    reduceat sums [starts[i], starts[i+1]), so the starts are the floors of the
    edges and the groups tile the range without gaps or overlap. Where the output
    is finer than the source two edges can floor to the same index; reduceat then
    yields that single pixel, and forcing the count to 1 leaves it untouched —
    which is the right answer when upsampling.
    """
    starts = np.clip(np.floor(edges).astype(np.int64), 0, limit)
    counts = np.maximum(np.diff(starts), 1).astype(np.float32)
    return starts, counts


def build(src: Image.Image, out_dir: pathlib.Path) -> int:
    pixels = np.asarray(src)
    src_h, src_w = pixels.shape[:2]
    print(f'  source {src_w}x{src_h}', flush=True)
    total = 0

    for z in range(MAX_ZOOM + 1):
        n = 2 ** z
        world = n * TILE

        # The horizontal split is the same for every tile row: longitude is linear
        # in Web Mercator, so this is computed once per zoom.
        col_starts, col_counts = groups(np.arange(world + 1) / world * src_w, src_w)

        for ty in range(n):
            ys = (ty + np.arange(TILE + 1) / TILE) / n
            row_starts, row_counts = groups((90 - mercator_lat(ys)) / 180 * src_h, src_h)

            # Only the rows this tile row actually covers are read. The last group
            # has to reach the end of the crop, which is what row_starts[-1] marks.
            top, bottom = int(row_starts[0]), int(max(row_starts[-1], row_starts[0] + 1))
            crop = pixels[top:bottom]

            # Vertical first: it collapses the tall axis, so nothing the size of the
            # source is ever held as float. dtype= keeps reduceat from upcasting to
            # a full float64 copy.
            #
            # The clamp is for the rows nearest the poles. Mercator compresses them
            # hardest in source space — at z0 the last output row spans about a
            # third of a source row — so consecutive boundaries floor to the same
            # index and the final one can land exactly on the end of the crop, which
            # reduceat rejects. Clamped, that row reads the single pixel it sits on.
            row_idx = np.minimum(row_starts[:-1] - top, len(crop) - 1)
            acc = np.add.reduceat(crop, row_idx, axis=0, dtype=np.float32)
            acc /= row_counts[:, None, None]
            acc = np.add.reduceat(acc, np.minimum(col_starts[:-1], src_w - 1), axis=1)
            acc /= col_counts[None, :, None]
            band = np.clip(np.rint(acc), 0, 255).astype(np.uint8)

            for tx in range(n):
                target = out_dir / str(z) / str(tx)
                target.mkdir(parents=True, exist_ok=True)
                path = target / f'{ty}.webp'
                Image.fromarray(band[:, tx * TILE:(tx + 1) * TILE]).save(
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
