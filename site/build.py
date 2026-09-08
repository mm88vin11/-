#!/usr/bin/env python3
"""Assemble the single-file build.

Everything the page needs — fonts, the wordmark, the 144-frame hero reel — is
inlined, so the deliverable is one .html that works from a file:// URL with no
server and no network. The frame reel is appended *after* the scripts on
purpose: the browser paints the loader and wires up the page before it has to
parse five megabytes of base64.
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC, ASSETS, OUT = ROOT / "src", ROOT / "assets", ROOT.parent / "index.html"

MIME = {".webp": "image/webp", ".png": "image/png",
        ".jpg": "image/jpeg", ".svg": "image/svg+xml"}


def uri(path: pathlib.Path) -> str:
    return "data:%s;base64,%s" % (
        MIME[path.suffix], base64.b64encode(path.read_bytes()).decode())


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


css = "\n".join(read(n) for n in sorted(p.name for p in SRC.glob("*.css")))
js = "\n".join(read(n) for n in sorted(p.name for p in SRC.glob("2*.js")))
body = read("10-body.html")

logo_eto = uri(ASSETS / "logo_eto.webp")
logo_baza = uri(ASSETS / "logo_baza.webp")
logo_lockup = uri(ASSETS / "logo_lockup.webp")

# Two reels, not one. The shot was cut twice — a 16:9 pass for wide screens
# and a 9:16 pass for phones — and the runtime picks whichever matches the
# viewport. Concatenating them (as an earlier build did) simply plays the
# desktop cut and then the mobile cut, which reads as two videos in a row.
reels = {}
for cut in ("d", "m"):
    fs = sorted((ASSETS / "seq" / cut).glob("*.webp"))
    if not fs:
        sys.exit(f"no hero frames in assets/seq/{cut} — run the asset prep first")
    reels[cut] = fs
# Frames are inlined byte-for-byte. They are already near-optimally encoded:
# re-compressing at matching quality comes out the same size or larger, and
# recompressing lossy WebP only throws detail away.
poster = uri(reels["d"][0])
poster_m = uri(reels["m"][0])

body = (body.replace("__LOGO_ETO__", logo_eto)
            .replace("__LOGO_BAZA__", logo_baza)
            .replace("__LOGO_LOCKUP__", logo_lockup)
            .replace("__POSTER_M__", poster_m)
            .replace("__POSTER__", poster))

fonts = (ASSETS / "fonts.css").read_text(encoding="utf-8")

# A still, one-paint grain plate. Generated here rather than shipped so it
# costs 1.6 KB instead of a texture download.
grain = (
    "data:image/svg+xml;base64," + base64.b64encode(
        b'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">'
        b'<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85"'
        b' numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate"'
        b' values="0"/></filter><rect width="180" height="180" filter="url(#n)"'
        b' opacity="0.5"/></svg>').decode())

seq_d = ",".join('"%s"' % uri(f) for f in reels["d"])
seq_m = ",".join('"%s"' % uri(f) for f in reels["m"])

_fav = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="14" fill="#0a0a0a"/>'
    '<text x="32" y="46" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"'
    ' font-size="36" font-weight="700" fill="#f2ebdd">\u0411</text></svg>')
favicon = "data:image/svg+xml;base64," + base64.b64encode(_fav.encode()).decode()

html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<!-- The zoom lock is deliberate and it is three things at once:
     `user-scalable=no` + `maximum-scale=1` stop Chrome/Android pinching;
     `touch-action: manipulation` in the stylesheet removes the double-tap
     delay that made every tap look like a twitch; and the gesture events are
     cancelled in script because Safari has ignored this meta since iOS 10.
     Together they are why the page no longer jumps, zooms or appears to
     reload under a finger. -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>БАЗА — сайты, CRM и боты для бизнеса, который держится на владельце</title>
<meta name="description" content="Делаем сайты, автоматизацию и ИИ-ботов, чтобы бизнес продавал без вашего участия. Разбор, вилка бюджета и сроки — в первом же ответе.">
<meta name="theme-color" content="#0a0a0a">
<meta name="color-scheme" content="dark light">
<meta name="author" content="БАЗА">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://lllbaza.ru/">

<meta property="og:type" content="website">
<meta property="og:site_name" content="БАЗА">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="БАЗА — сайты, CRM и боты для бизнеса, который держится на владельце">
<meta property="og:description" content="Вы не владелец. Вы самый дорогой сотрудник в своей компании. Давайте это исправим.">
<meta property="og:url" content="https://lllbaza.ru/">
<meta property="og:image" content="{poster}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" type="image/svg+xml" href="{favicon}">
<link rel="apple-touch-icon" href="{logo_lockup}">

<style>{fonts}</style>
<style>:root{{--grain:url("{grain}")}}</style>
<style>{css}</style>
</head>
<body>
{body}
<script>{js}</script>
<!-- The reel lands last. Everything above is already interactive by the time
     the browser starts parsing this array. -->
<script>window.__SEQ={{d:[{seq_d}],m:[{seq_m}]}};if(window.__seqReady)window.__seqReady(window.__SEQ);</script>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
kb = OUT.stat().st_size / 1024
print(f"built {OUT}  {kb/1024:.2f} MB  "
      f"(reel d={len(reels['d'])} m={len(reels['m'])}, "
      f"{len(css)//1024} KB css, {len(js)//1024} KB js)")
