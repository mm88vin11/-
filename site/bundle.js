#!/usr/bin/env node
// Rebuilds the standalone, self-extracting page from an existing builder export.
//
//   node site/bundle.js <original-export.html> [out.html]
//
// The export is a self-extracting bundle: an unpacker script, a manifest of
// base64 assets, and the page itself as a JSON string in a
// <script type="__bundler/template"> tag. Only that last line changes here —
// everything else (assets, unpacker, asset UUIDs) is copied through untouched,
// so the result opens by double-clicking exactly like the original.

const fs = require('path') && require('fs');
const path = require('path');

const [, , src, dst] = process.argv;
if (!src) {
  console.error('usage: node site/bundle.js <original-export.html> [out.html]');
  process.exit(1);
}
const out = dst || 'baza-site.html';
const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const lines = fs.readFileSync(src, 'utf8').split('\n');

const i = lines.findIndex((l) => l.indexOf('<script type="__bundler/template">') >= 0) + 1;
if (i <= 0) {
  console.error(src + ': no __bundler/template tag — is this a builder export?');
  process.exit(1);
}

// The payload sits inside a <script> tag, so every '</' has to be escaped or the
// HTML parser closes the tag at the first </script> in the page (the ld+json
// block, among others) and the unpacker gets truncated JSON. The builder's own
// encoder does the same thing.
lines[i] = JSON.stringify(page).replace(/<\//g, '<\\/');

fs.writeFileSync(out, lines.join('\n'));

// Fail loudly rather than shipping a bundle that dies in the unpacker.
const check = fs.readFileSync(out, 'utf8').split('\n')[i];
if (check.indexOf('</script>') >= 0) throw new Error('payload still closes the script tag');
if (JSON.parse(check) !== page) throw new Error('payload does not round-trip');

console.log(out, '—', (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
