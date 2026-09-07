#!/usr/bin/env python3
"""Pull every embedded asset out of the uploaded single-file build into real
files under site/assets/, and write a manifest the bundler reads back."""
import re, base64, os, json, hashlib, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else \
    '/root/.claude/uploads/4683eb6e-887d-5066-b05d-149b244d3aba/e3927f21-baza_3.html'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')

s = open(SRC, encoding='utf-8', errors='replace').read()
manifest = {}

def write(relpath, raw):
    p = os.path.join(ASSETS, relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(raw)
    manifest[relpath] = {'bytes': len(raw)}
    return p

# ---- 1. the frame sequence, keyed in window.__res -------------------------
tail = s[s.rindex('window.__res'):]
n = 0
for k, b64 in re.findall(r'"(assets/seq/[dm]/\d+\.webp)":"data:image/webp;base64,([A-Za-z0-9+/=]+)"', tail):
    write(k[len('assets/'):], base64.b64decode(b64)); n += 1
print(f'sequence frames: {n}')

# ---- 2. fonts -------------------------------------------------------------
head = s[:s.index('</head>')]
fonts = re.findall(
    r"font-family:\s*'([^']+)';\s*font-style:\s*(\w+);\s*font-weight:\s*(\d+);"
    r"[^}]*?src:\s*url\(data:font/woff2;base64,([A-Za-z0-9+/=]+)\)[^}]*?"
    r"unicode-range:\s*([^;]+);", head, re.S)
seen = {}
font_css = []
for fam, style, weight, b64, urange in fonts:
    raw = base64.b64decode(b64)
    h = hashlib.sha1(raw).hexdigest()[:8]
    slug = re.sub(r'[^a-z0-9]+', '-', fam.lower()).strip('-')
    rel = f'font/{slug}-{weight}-{h}.woff2'
    if h not in seen:
        write(rel, raw); seen[h] = rel
    font_css.append({'family': fam, 'style': style, 'weight': weight,
                     'file': seen[h], 'range': urange.strip()})
print(f'font faces: {len(font_css)} ({len(seen)} unique files)')

# ---- 3. images in the body (logos, poster, textures) ----------------------
imgs = []
for m in re.finditer(r'data:image/(png|webp|jpeg|svg\+xml);base64,([A-Za-z0-9+/=]{200,})', s):
    if m.start() > s.rindex('window.__res'):
        continue
    ext = {'png': 'png', 'webp': 'webp', 'jpeg': 'jpg', 'svg+xml': 'svg'}[m.group(1)]
    raw = base64.b64decode(m.group(2))
    h = hashlib.sha1(raw).hexdigest()[:10]
    rel = f'img/{h}.{ext}'
    if rel not in manifest:
        write(rel, raw)
    imgs.append({'sha': h, 'rel': rel, 'ext': ext, 'bytes': len(raw)})
print(f'body images: {len(imgs)} ({len({i["rel"] for i in imgs})} unique)')

json.dump({'fonts': font_css, 'images': imgs, 'files': manifest},
          open(os.path.join(ROOT, 'build', 'manifest.json'), 'w'), indent=1)
total = sum(v['bytes'] for v in manifest.values())
print(f'total on disk: {total/1048576:.2f} MB across {len(manifest)} files')
