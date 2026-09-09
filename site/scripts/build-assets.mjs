/**
 * Asset pipeline: turns the assets extracted from the legacy single-file build
 * into real files under public/assets.
 *
 * The reel is the whole reason the old page weighed 13.5 MB: 286 WebP frames
 * inlined as base64, which is ~33% larger than the bytes they encode and, being
 * part of the document, uncacheable and unstreamable. Here they become files —
 * downscaled, re-encoded, and cut to a frame budget.
 *
 * The reel stays WebP rather than AVIF on purpose. AVIF is ~25% smaller per
 * frame, but the reel is not one hero image: it is 150 images the main thread
 * decodes while the user scrubs, and AVIF decode is measurably slower per
 * frame. Bytes are a budget; a dropped frame is a bug. Stills that decode once
 * (posters, textures) do get AVIF with a WebP fallback.
 */
import sharp from 'sharp';
import { mkdir, readdir, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = process.env.ASSET_SRC;
if (!SRC) { console.error('ASSET_SRC (extracted legacy assets) is required'); process.exit(1); }
const OUT = new URL('../public/assets/', import.meta.url).pathname;

/**
 * `keep: [n, of]` samples n frames out of every `of`. The reel is scrubbed, not
 * played, and the runtime crossfades adjacent frames, so a sparser reel reads
 * as continuous motion while costing a third fewer bytes and decodes. The
 * screen inside the shot carries readable copy from roughly a quarter in, which
 * is why the width stays high and the saving is taken in frame count instead.
 */
const REEL = {
  d: { dir: 'seq_d', out: 'reel-d', width: 1216, quality: 50, keep: [1, 2] },
  m: { dir: 'seq_m', out: 'reel-m', width: 704,  quality: 50, keep: [1, 2] },
  /* A third, deliberately tiny cut, used only by `build:single`. The whole
     point of that target is one file that can travel as an attachment, so the
     reel there is 23 frames at 560px — enough for the shot to read when
     scrubbed, about 150 KB inlined instead of 1.6 MB. */
  s: { dir: 'seq_d', out: 'reel-s', width: 560, quality: 44, keep: [1, 8] },
};

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function reel(key) {
  const cfg = REEL[key];
  const dir = join(SRC, cfg.dir);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.webp')).sort();
  const [take, of] = cfg.keep;
  const picked = files.filter((_, i) => i % of < take);
  const outDir = join(OUT, cfg.out);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let total = 0;
  for (let i = 0; i < picked.length; i++) {
    const buf = await sharp(join(dir, picked[i]))
      .resize({ width: cfg.width, withoutEnlargement: true })
      .webp({ quality: cfg.quality, effort: 6, smartSubsample: true })
      .toBuffer();
    await writeFile(join(outDir, `f${String(i).padStart(3, '0')}.webp`), buf);
    total += buf.length;
  }
  const meta = await sharp(join(dir, picked[0])).metadata();
  console.log(`reel ${key}: ${picked.length} frames, ${kb(total)} (${kb(total / picked.length)}/frame), ${cfg.width}px`);
  return { key, frames: picked.length, bytes: total, width: cfg.width,
           aspect: +(meta.width / meta.height).toFixed(4) };
}

/** Stills: AVIF + WebP, both emitted, <picture> picks. */
async function still(file, name, { width, quality = 62 } = {}) {
  const src = join(SRC, file);
  const base = sharp(src).resize(width ? { width, withoutEnlargement: true } : undefined);
  const webp = await base.clone().webp({ quality, effort: 6 }).toBuffer();
  const avif = await base.clone().avif({ quality: quality - 8, effort: 5 }).toBuffer();
  await writeFile(join(OUT, 'img', `${name}.webp`), webp);
  await writeFile(join(OUT, 'img', `${name}.avif`), avif);
  const m = await sharp(webp).metadata();
  console.log(`still ${name}: ${m.width}x${m.height} webp ${kb(webp.length)} / avif ${kb(avif.length)}`);
  return { name, w: m.width, h: m.height, webp: webp.length, avif: avif.length };
}

/** The wordmarks keep alpha and stay PNG-free: they are masks as much as art. */
async function mark(file, name, width) {
  const src = join(SRC, file);
  const webp = await sharp(src).resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6, alphaQuality: 88 }).toBuffer();
  await writeFile(join(OUT, 'img', `${name}.webp`), webp);
  const m = await sharp(webp).metadata();
  console.log(`mark ${name}: ${m.width}x${m.height} ${kb(webp.length)}`);
  return { name, w: m.width, h: m.height, bytes: webp.length };
}

await mkdir(join(OUT, 'img'), { recursive: true });

const manifest = { reel: {}, img: {}, marks: {} };
for (const key of ['d', 'm', 's']) {
  const r = await reel(key);
  manifest.reel[key] = { frames: r.frames, width: r.width, aspect: r.aspect, bytes: r.bytes };
}
manifest.img.posterWide = await still('poster-wide.webp', 'poster-wide', { width: 1440 });
manifest.img.posterTall = await still('poster-tall.webp', 'poster-tall', { width: 810 });
manifest.marks.logo = await mark('logo-full.webp', 'logo', 340);
manifest.marks.eto  = await mark('mark-eto.webp',  'mark-eto', 640);
manifest.marks.baza = await mark('mark-baza.webp', 'mark-baza', 640);

await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

let grand = 0;
for (const [, v] of Object.entries(manifest.reel)) grand += v.bytes;
console.log(`\nreel total (both cuts on disk): ${kb(grand)} — only one cut is ever fetched`);
