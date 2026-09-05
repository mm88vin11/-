#!/usr/bin/env python3
"""Build the deployable site.

    src/template.html   markup + page logic
    src/resources.json  runtime id -> file path
    src/assets/**       images (frame sequences, logos, baked hazes)
    src/vendor/**       react, react-dom, dc-runtime, page runtime
        ->  dist/       upload this directory as-is

Run `python3 haze.py` first if the background frames changed.
"""
import json, pathlib, re, shutil

SRC = pathlib.Path('src')
OUT = pathlib.Path('dist')

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
shutil.copytree(SRC / 'assets', OUT / 'assets')
shutil.copytree(SRC / 'vendor', OUT / 'vendor')

html = (SRC / 'template.html').read_text(encoding='utf-8')
resources = json.loads((SRC / 'resources.json').read_text(encoding='utf-8'))

inject = ('<script>window.__resources = '
          + json.dumps(resources, ensure_ascii=False).replace('</', '<\\/')
          + ';</' + 'script>')
head = re.search(r'<head[^>]*>', html, re.I)
if not head:
    raise SystemExit('template has no <head>')
i = head.end()
html = html[:i] + inject + html[i:]

(OUT / 'index.html').write_text(html, encoding='utf-8')

files = [f for f in OUT.rglob('*') if f.is_file()]
total = sum(f.stat().st_size for f in files)
print(f'dist/  files={len(files)}  total={total / 1048576:.1f} MB  '
      f'index.html={len(html) / 1024:.0f} KB')
