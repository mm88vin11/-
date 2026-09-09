/**
 * The reel for `build:single`, and only for it.
 *
 * The deploy build streams 91 frames as files. A single HTML file cannot, so
 * this makes a deliberately smaller cut — enough frames for the shot to read
 * when scrubbed, at a resolution that survives being inlined as base64. It is
 * the one place on this project where a data URI is the right answer, and it
 * is still an order of magnitude below the 12 MB the old build inlined.
 *
 *   ASSET_SRC=<dir with seq_d/> node scripts/build-single-reel.mjs
 */
import sharp from 'sharp';
import { mkdir, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = process.env.ASSET_SRC;
if (!SRC) { console.error('ASSET_SRC is required'); process.exit(1); }

const KEEP_EVERY = 4;   /* 182 → 46 frames */
const WIDTH = 720;
const QUALITY = 46;

const dir = join(SRC, 'seq_d');
const out = new URL('../public/assets/reel-s/', import.meta.url).pathname;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const files = (await readdir(dir)).filter((f) => f.endsWith('.webp')).sort()
  .filter((_, i) => i % KEEP_EVERY === 0);

let total = 0;
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(join(dir, files[i]))
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
    .toBuffer();
  await writeFile(join(out, `f${String(i).padStart(3, '0')}.webp`), buf);
  total += buf.length;
}
console.log(`reel-s: ${files.length} frames at ${WIDTH}px, ${(total / 1024).toFixed(0)} KB ` +
            `(~${(total * 1.34 / 1024).toFixed(0)} KB once base64-encoded into the single file)`);
