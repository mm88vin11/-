#!/usr/bin/env python3
"""Собрать сайт в один HTML-файл.

    src/  ->  dist-single/lllbaza.html

Всё внутри: картинки и шрифты как data:-ссылки, скрипты — прямо в разметке.
Файл открывается двойным кликом и заливается на хостинг как один файл.
Для обычного хостинга лучше dist/ из build.py — он грузится быстрее.
"""
import base64, json, mimetypes, pathlib, re

SRC = pathlib.Path('src')
OUT = pathlib.Path('dist-single/lllbaza.html')
OUT.parent.mkdir(parents=True, exist_ok=True)

MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.js': 'text/javascript', '.mp4': 'video/mp4'}


def data_uri(rel):
    f = SRC / rel
    raw = f.read_bytes()
    mime = MIME.get(f.suffix.lower()) or mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')


html = (SRC / 'template.html').read_text(encoding='utf-8')
resources = json.loads((SRC / 'resources.json').read_text(encoding='utf-8'))

# 1. Ссылки на файлы в разметке — в data:. Скрипты тоже остаются тегами со
# src, а не вставляются текстом: рантайм читает свой currentScript.
for m in sorted(set(re.findall(r'(?:src|href)="((?:assets|vendor)/[^"]+)"', html)), key=len, reverse=True):
    html = html.replace('"%s"' % m, '"%s"' % data_uri(m))

# 2. Фон заставки задан в CSS как url(assets/...) — он тоже должен уехать внутрь.
for m in sorted(set(re.findall(r'url\((assets/[^)\'"]+)\)', html)), key=len, reverse=True):
    html = html.replace('url(%s)' % m, 'url(%s)' % data_uri(m))

# 3. Карта ресурсов, которую читает рантайм.
inline = {k: data_uri(v) for k, v in resources.items()}
inject = ('<script>window.__resources = '
          + json.dumps(inline, ensure_ascii=False).replace('</', '<\\/')
          + ';</' + 'script>')
head = re.search(r'<head[^>]*>', html, re.I)
html = html[:head.end()] + inject + html[head.end():]

left = [x for x in re.findall(r'(?:src|href)="(?!data:|https?:|#|mailto:)([^"]+)"', html)
        if '{{' not in x]  # шаблонные подстановки — не ссылки
if left:
    raise SystemExit('остались внешние ссылки: ' + ', '.join(sorted(set(left))[:5]))

OUT.write_text(html, encoding='utf-8')
print(f'{OUT}  {OUT.stat().st_size / 1048576:.1f} MB')
