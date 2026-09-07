#!/usr/bin/env python3
"""Assemble src/ + assets/ into a single self-contained dist/index.html.

Two outputs from one source tree:
  --folder   dist/site/  — real files, normal HTTP, best caching
  (default)  dist/index.html — everything inlined, works from file:// and can
             be handed over as one attachment

Inlining costs 33% on top of every binary (base64), so the folder build is the
one to deploy. The single file exists because that is how this site has always
been delivered for review.
"""
import base64, json, os, re, shutil, sys, mimetypes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ASSETS = os.path.join(ROOT, 'assets')
DIST = os.path.join(ROOT, 'dist')

MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}


def read(p):
    return open(p, encoding='utf-8').read()


def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(path, 'rb').read()).decode())


def ordered(dirname, ext):
    d = os.path.join(SRC, dirname)
    return [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(ext)]


def font_face_css(manifest, inline):
    """@font-face blocks rebuilt from the manifest, so adding a weight is a
    data change rather than a hand-edited wall of base64."""
    out = []
    for f in manifest['fonts']:
        src = data_uri(os.path.join(ASSETS, f['file'])) if inline else 'assets/' + f['file']
        out.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
            "src:url(%s) format('woff2');unicode-range:%s}"
            % (f['family'], f['style'], f['weight'], src, f['range']))
    return '\n'.join(out)


def build(inline=True):
    manifest = json.load(open(os.path.join(ROOT, 'build', 'manifest.json')))
    html = read(os.path.join(SRC, 'index.html'))

    # ---- css ---------------------------------------------------------------
    css = [font_face_css(manifest, inline)]
    for p in ordered('css', '.css'):
        css.append('/* ===== %s ===== */\n%s' % (os.path.basename(p), read(p)))
    css_txt = '\n'.join(css)
    if inline:
        # any assets/ reference inside CSS has to become a data URI too
        css_txt = re.sub(r'assets/([\w./-]+\.(?:webp|png|jpg|svg))',
                         lambda m: data_uri(os.path.join(ASSETS, m.group(1))), css_txt)
    html = html.replace('<!--@css-->', '<style>\n%s\n</style>' % css_txt)

    # ---- js ----------------------------------------------------------------
    js = []
    for p in ordered('js', '.js'):
        js.append('/* ===== %s ===== */\n%s' % (os.path.basename(p), read(p)))
    html = html.replace('<!--@js-->', '<script>\n%s\n</script>' % '\n'.join(js))

    # ---- images referenced from the markup ---------------------------------
    if inline:
        html = re.sub(r'(?<=["\'(])assets/(img/[\w.-]+)(?=["\')])',
                      lambda m: data_uri(os.path.join(ASSETS, m.group(1))), html)

    # ---- the frame sequence ------------------------------------------------
    if inline:
        res = {}
        for grp in ('d', 'm'):
            gdir = os.path.join(ASSETS, 'seq', grp)
            for f in sorted(os.listdir(gdir)):
                res['assets/seq/%s/%s' % (grp, f)] = data_uri(os.path.join(gdir, f))
        tag = ('<script>window.__bundled=1;window.__res=window.__res||{};'
               'Object.assign(window.__res,%s);</script>' % json.dumps(res, separators=(',', ':')))
        html = html.replace('<!--@res-->', tag)
    else:
        html = html.replace('<!--@res-->', '')

    os.makedirs(DIST, exist_ok=True)
    if inline:
        out = os.path.join(DIST, 'index.html')
        open(out, 'w', encoding='utf-8').write(html)
    else:
        site = os.path.join(DIST, 'site')
        if os.path.isdir(site):
            shutil.rmtree(site)
        os.makedirs(site)
        shutil.copytree(ASSETS, os.path.join(site, 'assets'))
        out = os.path.join(site, 'index.html')
        open(out, 'w', encoding='utf-8').write(html)

    size = os.path.getsize(out)
    print('%-28s %7.2f MB' % (os.path.relpath(out, ROOT), size / 1048576))
    return out


if __name__ == '__main__':
    if '--folder' in sys.argv:
        build(inline=False)
    elif '--both' in sys.argv:
        build(inline=False)
        build(inline=True)
    else:
        build(inline=True)
