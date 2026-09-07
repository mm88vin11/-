/* ==========================================================================
   Builds dist/baza.html — the whole site as one file.

     node build-single.mjs

   Everything is inlined: stylesheets, scripts, fonts, logos and both frame
   reels. The reels are the bulk of it and go at the very END of the body,
   not in the head: a browser paints nothing until it has read the head, so
   twenty megabytes of base64 up there would mean a blank screen for as long
   as the download takes. Down there the boot screen is already on screen
   while the catalogue streams in behind it, and hero.js waits for
   DOMContentLoaded before reading it (see `__bundled` in hero.js).

   The folder build is still the better way to serve this — it streams, it
   caches per file, and a repeat visit re-downloads nothing. Use the single
   file when you need something you can hand over or open directly.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'baza.html');

const MIME = {
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
};

const read = p => fs.readFileSync(path.join(ROOT, p));
const dataURI = p => {
  const ext = path.extname(p).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error('no mime for ' + p);
  return `data:${mime};base64,${read(p).toString('base64')}`;
};

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---- 1. stylesheets, with their fonts folded in ------------------------- */

let cssBytes = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">\n?/g, (_, href) => {
  let css = fs.readFileSync(path.join(ROOT, href), 'utf8');
  // font URLs in the CSS are relative to assets/css/
  css = css.replace(/url\((\.\.\/fonts\/[^)]+)\)/g, (__, rel) => {
    const p = path.posix.join(path.posix.dirname(href), rel);
    return `url(${dataURI(p)})`;
  });
  cssBytes += css.length;
  return `<style>\n${css}\n</style>\n`;
});

/* ---- 2. preloads: nothing left to preload, they would only 404 ---------- */

html = html.replace(/<link rel="preload"[^>]*>\n?/g, '');

/* ---- 3. favicon + every <img> in the markup ---------------------------- */

html = html.replace(/href="(assets\/img\/[^"]+)"/g, (_, p) => `href="${dataURI(p)}"`);
html = html.replace(/src="(assets\/img\/[^"]+)"/g, (_, p) => `src="${dataURI(p)}"`);

/* ---- 4. scripts, in order --------------------------------------------- */

let jsBytes = 0;
let first = true;
html = html.replace(/<script src="(assets\/js\/[^"]+)"><\/script>\n?/g, (_, src) => {
  const js = fs.readFileSync(path.join(ROOT, src), 'utf8');
  jsBytes += js.length;
  // the flag has to be set before any module reads it
  const flag = first ? '<script>window.__bundled=1;window.__res={};</script>\n' : '';
  first = false;
  // a literal </script> inside a string would close the tag early
  return `${flag}<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
});

/* ---- 5. the reels, appended last --------------------------------------- */

const seqDirs = ['assets/seq/d', 'assets/seq/m'];
const entries = [];
let seqBytes = 0;
for (const dir of seqDirs) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
    if (!f.endsWith('.webp')) continue;
    const rel = `${dir}/${f}`;
    seqBytes += fs.statSync(path.join(ROOT, rel)).size;
    entries.push(JSON.stringify(rel) + ':' + JSON.stringify(dataURI(rel)));
  }
}
const catalogue =
  '<script>/* The frame reels. Twenty megabytes of base64 in the head would ' +
  'mean the browser paints nothing until it has read all of it; down here the ' +
  'boot screen is already up. hero.js reads this on DOMContentLoaded. */\n' +
  'Object.assign(window.__res, {' + entries.join(',') + '});</script>\n';

html = html.replace('</body>', catalogue + '</body>');

/* ---- 6. write ---------------------------------------------------------- */

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

const mb = n => (n / 1048576).toFixed(2) + ' MB';
console.log(`dist/baza.html  ${mb(Buffer.byteLength(html))}`);
console.log(`  css ${(cssBytes / 1024).toFixed(0)} KB · js ${(jsBytes / 1024).toFixed(0)} KB` +
  ` · ${entries.length} frames (${mb(seqBytes)} on disk, +33% as base64)`);
