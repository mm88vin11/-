/* Собирает всё в один HTML: CSS, шрифты, скрипты и все кадры внутрь файла,
   чтобы он открывался с диска без единого внешнего запроса.

       node site/build.js      →  baza.html в корне репозитория

   Осторожно с String.replace: в коде есть строковый литерал '01ア#$', а
   последовательности $&, $', $` и $1 в *замене* — специальные шаблоны.
   Поэтому все замены здесь передают функцию, а не строку. */
const fs = require('fs'), path = require('path');
const SRC = '/home/user/-/site';
const OUT = '/home/user/-/baza.html';

const read = p => fs.readFileSync(path.join(SRC, p), 'utf8');
const b64 = p => fs.readFileSync(path.join(SRC, p)).toString('base64');
const mime = f => f.endsWith('.webp') ? 'image/webp'
  : f.endsWith('.png') ? 'image/png'
  : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
const dataUri = p => `data:${mime(p)};base64,${b64(p)}`;

let html = read('index.html');

/* ---- fonts: rewrite ./X.woff2 inside fonts.css to data URIs -------------- */
let fontCss = read('fonts/fonts.css').replace(
  /url\(\.\/([^)]+\.woff2)\)/g,
  (_, f) => `url(${dataUri('fonts/' + f)})`
);

const css = [
  '/* ---- fonts ---- */', fontCss,
  '/* ---- core ---- */', read('css/core.css'),
  '/* ---- universes ---- */', read('css/universes.css')
].join('\n');

/* ---- drop external stylesheet + preload links --------------------------- */
html = html.replace(/<link rel="preload" as="font"[^>]*>\n/g, '');
html = html.replace(/<link rel="preload" as="image"[^>]*>\n/g, '');
html = html.replace(/<link rel="stylesheet" href="fonts\/fonts\.css">\n/, '');
html = html.replace(/<link rel="stylesheet" href="css\/core\.css">\n/, '');
html = html.replace(
  /<link rel="stylesheet" href="css\/universes\.css">/,
  () => '<style>\n' + css + '\n</style>'
);

/* ---- small images that must be there on the very first paint ------------ */
['assets/assets/logo.webp', 'assets/assets/logo-eto-2x.webp',
 'assets/assets/logo-baza-2x.webp', 'assets/seqd/f000.webp'].forEach(f => {
  html = html.split(`"${f}"`).join(`"${dataUri(f)}"`); // split/join: no $ patterns
});

/* ---- scripts inline, in order ------------------------------------------- */
const order = ['core.js','audio.js','data.js','hero.js','universes.js',
               'sections.js','sections2.js','transitions.js','brief.js','app.js'];
const scriptTags = order.map(f => `<script src="js/${f}"></script>`).join('\n');
const js = order.map(f => {
  const body = read('js/' + f);
  if (body.includes('</script')) throw new Error('literal </script in ' + f);
  return `/* ===== ${f} ===== */\n${body}`;
}).join('\n');

html = html.replace(scriptTags,
  () => '<script>window.__bundled=1;window.__res={};</script>\n<script>\n' + js + '\n</script>');
if (html.includes('<script src="js/')) throw new Error('script tags not replaced');

/* ---- the frame catalogue, last ------------------------------------------ */
const dirs = ['seqd', 'seqm5', 'seqdc', 'closem5'];
const entries = [];
let bytes = 0;
for (const dir of dirs) {
  for (const f of fs.readdirSync(path.join(SRC, 'assets', dir)).sort()) {
    const rel = `assets/${dir}/${f}`;
    const enc = b64(rel);
    bytes += enc.length;
    entries.push(JSON.stringify(rel) + ':"data:image/webp;base64,' + enc + '"');
  }
}
const catalogue =
  '<script>/* Кадры сцены с ноутбуком. Каталог стоит в самом конце body: ' +
  'двадцать мегабайт base64 в <head> означали бы, что браузер не рисует ' +
  'ничего, пока не дочитает их. hero.js читает его на DOMContentLoaded. */\n' +
  'Object.assign(window.__res,{' + entries.join(',') + '});</script>\n';

html = html.replace('</body>', () => catalogue + '</body>');

fs.writeFileSync(OUT, html);
const size = fs.statSync(OUT).size;
console.log('frames inlined:', entries.length, '(' + (bytes / 1048576).toFixed(1) + ' MB base64)');
console.log('written', OUT, (size / 1048576).toFixed(2), 'MB');
