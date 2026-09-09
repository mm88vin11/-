import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two targets, one source.
 *
 *  `build`        — the deploy target. Chunked, hashed, HTTP-cacheable; every
 *                   world is its own chunk pulled in one section ahead of time.
 *  `build:single` — one HTML file, for when the whole site has to travel as an
 *                   attachment. Same code, inlined. It is explicitly the lesser
 *                   build: nothing can be cached and nothing streams.
 *
 * `assetsInlineLimit: 0` is the rule the previous build broke. Nothing becomes
 * a data URI, ever — that is how 12 MB of WebP ended up inside a <script>.
 */
const single = process.env.SINGLE === '1';

/**
 * `virtual:reel-inline` — the hero reel as data URIs, for the single-file
 * target only.
 *
 * The whole reason this project exists is that the previous build inlined 286
 * frames as base64 and weighed 13.5 MB. So the single-file target does not get
 * the real reel: it gets `reel-s`, 23 frames at 560px, about 250 KB encoded.
 * The shot still scrubs; it is simply a lower-resolution print of it.
 *
 * In the normal build `__SINGLE__` folds to `false`, the branch that imports
 * this module is dead code, and the bundler drops both the branch and the
 * module. Nothing here reaches the deploy target.
 */
function inlineReel(): Plugin {
  const id = 'virtual:reel-inline';
  const resolved = `\0${id}`;
  return {
    name: 'baza-inline-reel',
    resolveId(source) { return source === id ? resolved : null; },
    load(loadId) {
      if (loadId !== resolved) return null;
      if (!single) return 'export const FRAMES = [];';
      const dir = join(process.cwd(), 'public/assets/reel-s');
      const frames = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()
        .map((f) => `data:image/webp;base64,${readFileSync(join(dir, f)).toString('base64')}`);
      return `export const FRAMES = ${JSON.stringify(frames)};`;
    },
  };
}

export default defineConfig({
  base: './',
  /* The single-file target takes nothing from public/: its reel is the inlined
     `reel-s`, and copying 2.4 MB of frames next to a self-contained file would
     defeat the point of it. */
  publicDir: single ? false : 'public',
  define: { __SINGLE__: JSON.stringify(single) },
  plugins: single ? [inlineReel(), viteSingleFile({ removeViteModuleLoader: true })] : [inlineReel()],
  build: {
    target: 'es2020',
    assetsInlineLimit: single ? 100_000_000 : 0,
    cssCodeSplit: !single,
    /* 'hidden': maps are emitted for debugging a production incident but no
       `sourceMappingURL` comment ships, so nothing is fetched by a visitor. */
    sourcemap: single ? false : 'hidden',
    minify: 'terser',
    terserOptions: { compress: { passes: 2, drop_console: process.env.KEEPLOG !== '1' }, format: { comments: false } },
    reportCompressedSize: true,
    rollupOptions: {
      output: single ? {} : {
        /* Heavy renderers are shared chunks, not per-world copies: three is
           pulled in by #craft and #route, matter by #pain and #pricing. */
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/matter-js')) return 'vendor-matter';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'vendor-motion';
          if (id.includes('node_modules/ogl')) return 'vendor-gl';
          return undefined;
        },
        chunkFileNames: 'a/[name]-[hash].js',
        entryFileNames: 'a/[name]-[hash].js',
        assetFileNames: 'a/[name]-[hash][extname]',
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
