#!/usr/bin/env python3
"""Bake the two full-viewport background hazes.

They used to be full-size frames carrying `filter: blur(72px)` and `blur(88px)`
under an endless drift animation — the single most expensive thing on the page.
Blur and colour grade are baked in here, at a size where the browser's own
upscale supplies the rest of the softness, so the runtime filter can go away.
"""
import pathlib
from PIL import Image, ImageEnhance, ImageFilter

OUT = pathlib.Path('src/assets/haze')
OUT.mkdir(parents=True, exist_ok=True)

# src, out, displayed width relative to a 1440px viewport, css blur px,
# brightness, saturation, contrast
JOBS = [
    ('src/assets/seqd/f000.webp',   'd.webp',  1958, 72, 0.34, 0.72, 1.06),
    ('src/assets/seqdc/f036.webp',  'd2.webp', 2074, 88, 0.40, 0.60, 1.00),
    ('src/assets/seqm5/f000.webp',  'm.webp',   530, 72, 0.34, 0.72, 1.06),
]
BASE_W = 160

for src, name, shown_w, css_blur, bright, sat, contrast in JOBS:
    im = Image.open(src).convert('RGB')
    w = BASE_W
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    # CSS blur(N) is a Gaussian with stddev N/2; scale it into the small raster
    # and leave a little of it to the browser's bilinear upscale.
    sigma = (css_blur / 2) * (w / shown_w) * 0.8
    im = im.filter(ImageFilter.GaussianBlur(radius=sigma))
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = ImageEnhance.Brightness(im).enhance(bright)
    dest = OUT / name
    im.save(dest, 'WEBP', quality=88, method=6)
    print(f'{dest}  {im.size}  {dest.stat().st_size} B  (sigma {sigma:.2f})')
