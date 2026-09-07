#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build.js — inline every stylesheet, script, font and image into one
   self-contained HTML file that opens straight from the filesystem.

     node build.js            → dist/baza-arcade.html
   ═══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const b64  = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');

const MIME = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const dataURI = (p) => 'data:' + (MIME[path.extname(p)] || 'application/octet-stream') + ';base64,' + b64(p);

let html = read('index.html');

/* 1 · fonts.css points at ../fonts/*.woff2 — inline each face */
function inlineCss(cssPath) {
  const dir = path.dirname(cssPath);
  return read(cssPath).replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, url) => {
    if (/^(data:|https?:)/.test(url)) return m;
    const abs = path.normalize(path.join(dir, url));
    if (!fs.existsSync(path.join(ROOT, abs))) return m;
    return "url('" + dataURI(abs) + "')";
  });
}

/* 2 · every <link rel=stylesheet href="assets/..."> becomes a <style> */
html = html.replace(/[ \t]*<link rel="stylesheet" href="(assets\/[^"]+)">\n?/g, (m, href) =>
  '<style>\n/* ' + href + ' */\n' + inlineCss(href) + '\n</style>\n');

/* 3 · preload hints are pointless once the fonts are inline */
html = html.replace(/[ \t]*<link rel="preload"[^>]*>\n?/g, '');

/* 4 · every <script src="assets/..."> becomes an inline script */
html = html.replace(/[ \t]*<script src="(assets\/[^"]+)"><\/script>\n?/g, (m, src) =>
  '<script>\n/* ' + src + ' */\n' + read(src) + '\n</script>\n');

/* 5 · images referenced from markup become data URIs */
html = html.replace(/(src|href)="(assets\/img\/[^"]+)"/g, (m, attr, p) => attr + '="' + dataURI(p) + '"');

/* 6 · a one-line note at the top of the file for whoever opens it */
html = html.replace('<head>',
  '<head>\n<!--\n  БАЗА · Arcade Edition — standalone build.\n' +
  '  Everything (styles, scripts, fonts, images) is inlined: no network,\n' +
  '  no build step. Open this file in any modern browser.\n' +
  '  Source: index.html + assets/ in the repository.\n-->');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'baza-arcade.html');
fs.writeFileSync(out, html);

const left = html.match(/(src|href)="assets\//g);
console.log('wrote dist/baza-arcade.html — ' + (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MB');
console.log(left ? 'WARNING: unresolved asset references: ' + left.length : 'no external asset references remain');
