"""Make the globe's night lights (public/assets/img/earth-lights.png) from real city populations.

Every city in Natural Earth's populated places adds a soft glow, as bright as its population and
a little wider for bigger cities. The glow is kept to land and the coast, then saved as a small
grayscale map that the globe's shader reads on its night side.

    curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson
    python3 tools/globe/night_lights.py ne_10m_populated_places_simple.geojson

Needs Python 3 with NumPy and Pillow. Natural Earth data is in the public domain.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

IMG = Path(__file__).resolve().parents[2] / 'public' / 'assets' / 'img'
W, H = 1024, 512  # worked out at the land mask's size, saved at half of it


def main(places_path):
    land = Image.open(IMG / 'earth-land-mask.png').convert('L')
    assert land.size == (W, H)

    glow = np.zeros((H, W))
    places = json.loads(Path(places_path).read_text())['features']
    for f in places:
        p = f['properties']
        pop = p.get('pop_max') or 0
        if pop <= 0:
            continue
        lat, lon = p['latitude'], p['longitude']
        cx = (lon + 180) / 360 * W
        cy = (90 - lat) / 180 * H
        sy = 1.4 + 1.6 * (pop / 1e7) ** 0.4  # in pixels
        sx = sy / max(np.cos(np.radians(lat)), 0.2)  # a degree of longitude shrinks toward the poles
        r = int(np.ceil(3 * sx))
        xs = np.arange(int(cx) - r, int(cx) + r + 1)
        ys = np.arange(max(int(cy) - r, 0), min(int(cy) + r + 1, H))
        g = np.exp(-((xs[None, :] - cx) ** 2) / (2 * sx * sx) - ((ys[:, None] - cy) ** 2) / (2 * sy * sy))
        glow[ys[0]:ys[-1] + 1, xs % W] += pop / 1e6 * g  # % W wraps around the date line

    lights = 1 - np.exp(-1.5 * glow)
    lights *= np.asarray(land.filter(ImageFilter.MaxFilter(9))) / 255  # land and the coast only
    lights[lights < 0.12] = 0
    out = Image.fromarray((lights * 255).round().astype(np.uint8), 'L').resize((W // 2, H // 2), Image.LANCZOS)
    out = Image.fromarray((np.round(np.asarray(out) / 4) * 4).clip(0, 255).astype(np.uint8), 'L')  # compresses better
    out.save(IMG / 'earth-lights.png', optimize=True)
    print(f'{len(places)} places -> {IMG / "earth-lights.png"}')


if __name__ == '__main__':
    main(sys.argv[1])
